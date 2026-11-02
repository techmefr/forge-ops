import type Database from 'better-sqlite3'
import {
  REVIEW_LENS_SEQUENCE,
  type ReviewFinding,
  type ReviewFindingDraft,
  type ReviewLens,
  type ReviewPass,
} from './Checkpoint.js'
import { createReviewCascade } from './ReviewPassCascade.js'
import {
  LensAlreadyPassedError,
  LensOutOfOrderError,
  SelfReviewRefusedError,
  UnresolvedFindingError,
} from './CheckpointViolation.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'
import type { AgentPhase } from '../Agent/AgentSession.js'
import { UnknownAgentSessionError } from '../Agent/AgentViolation.js'

import { prepareReviewStatements, toFinding } from './ReviewStatements.js'

const PRODUCING_PHASES: readonly AgentPhase[] = ['spec', 'architecture', 'tdd', 'code', 'ship']

export type ReviewRepository = {
  recordFinding: (draft: ReviewFindingDraft) => ReviewFinding
  listUnresolvedFindings: (storyId: number) => readonly ReviewFinding[]
  countUnresolvedStrongFindings: (storyId: number) => number
  resolveFinding: (findingId: number) => void
  reviewCascade: (storyId: number) => readonly ReviewPass[]
  startLens: (storyId: number, lens: ReviewLens, claudeSessionId: string) => ReviewPass
  passLens: (storyId: number, lens: ReviewLens) => ReviewPass
}

export function createReviewRepository(db: Database.Database): ReviewRepository {
  const statements = prepareReviewStatements(db)
  const {
    selectStory,
    selectSession,
    selectSessionWithPhase,
    insertFinding,
    selectFinding,
    selectUnresolvedFindings,
    selectUnresolvedStrongCount,
    updateFindingResolved,
    upsertPassRunning,
    updatePassPassed,
    selectUnresolvedStrongForLens,
  } = statements
  const { reviewCascade, passOf } = createReviewCascade(statements)

  return {
    recordFinding: (draft) => {
      const session = selectSession.get(draft.claudeSessionId)
      if (session === undefined) {
        throw new UnknownAgentSessionError(draft.claudeSessionId)
      }
      const info = insertFinding.run(
        draft.storyId,
        session.id,
        draft.lens,
        draft.severity,
        draft.path,
        draft.line ?? null,
        draft.statement,
      )
      const row = selectFinding.get(Number(info.lastInsertRowid))
      if (row === undefined) {
        throw new StoryNotFoundError(draft.storyId)
      }
      return toFinding(row)
    },

    listUnresolvedFindings: (storyId) => selectUnresolvedFindings.all(storyId).map(toFinding),

    countUnresolvedStrongFindings: (storyId) => selectUnresolvedStrongCount.get(storyId)?.total ?? 0,

    resolveFinding: (findingId) => {
      updateFindingResolved.run(findingId)
    },

    reviewCascade,

    startLens: (storyId, lens, claudeSessionId) => {
      if (selectStory.get(storyId) === undefined) {
        throw new StoryNotFoundError(storyId)
      }
      const session = selectSessionWithPhase.get(claudeSessionId)
      if (session === undefined) {
        throw new UnknownAgentSessionError(claudeSessionId)
      }
      if (PRODUCING_PHASES.includes(session.phase)) {
        throw new SelfReviewRefusedError(claudeSessionId, session.phase)
      }
      const cascade = reviewCascade(storyId)
      const index = REVIEW_LENS_SEQUENCE.indexOf(lens)
      const blocking = cascade
        .slice(0, index)
        .find((candidate) => candidate.state !== 'passed')
      if (blocking !== undefined) {
        throw new LensOutOfOrderError(lens, blocking.lens)
      }
      if (passOf(storyId, lens).state === 'passed') {
        throw new LensAlreadyPassedError(lens)
      }
      upsertPassRunning.run(storyId, lens, session.id)
      return passOf(storyId, lens)
    },

    passLens: (storyId, lens) => {
      const pass = passOf(storyId, lens)
      if (pass.state === 'passed') {
        throw new LensAlreadyPassedError(lens)
      }
      if (pass.state === 'pending') {
        throw new LensOutOfOrderError(lens, lens)
      }
      const unresolved = selectUnresolvedStrongForLens.get(storyId, lens)?.total ?? 0
      if (unresolved > 0) {
        throw new UnresolvedFindingError(unresolved)
      }
      updatePassPassed.run(storyId, lens)
      return passOf(storyId, lens)
    },
  }
}
