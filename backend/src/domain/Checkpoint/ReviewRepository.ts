import type Database from 'better-sqlite3'
import {
  REVIEW_LENS_SEQUENCE,
  type FindingSeverity,
  type ReviewFinding,
  type ReviewFindingDraft,
  type ReviewLens,
  type ReviewPass,
  type ReviewPassState,
} from './Checkpoint.js'
import {
  LensAlreadyPassedError,
  LensOutOfOrderError,
  SelfReviewRefusedError,
  UnresolvedFindingError,
} from './CheckpointViolation.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'
import type { AgentPhase } from '../Agent/AgentSession.js'
import { UnknownAgentSessionError } from '../Agent/AgentViolation.js'

const PRODUCING_PHASES: readonly AgentPhase[] = ['spec', 'architecture', 'tdd', 'code', 'ship']

type PassRow = {
  lens: ReviewLens
  state: ReviewPassState
  agent_name: string | null
}

type FindingRow = {
  id: number
  story_id: number
  lens: ReviewLens
  severity: FindingSeverity
  path: string
  statement: string
}

export type ReviewRepository = {
  recordFinding: (draft: ReviewFindingDraft) => ReviewFinding
  listUnresolvedFindings: (storyId: number) => readonly ReviewFinding[]
  countUnresolvedStrongFindings: (storyId: number) => number
  resolveFinding: (findingId: number) => void
  reviewCascade: (storyId: number) => readonly ReviewPass[]
  startLens: (storyId: number, lens: ReviewLens, claudeSessionId: string) => ReviewPass
  passLens: (storyId: number, lens: ReviewLens) => ReviewPass
}

function toFinding(row: FindingRow): ReviewFinding {
  return {
    id: row.id,
    storyId: row.story_id,
    lens: row.lens,
    severity: row.severity,
    path: row.path,
    statement: row.statement,
  }
}

export function createReviewRepository(db: Database.Database): ReviewRepository {
  const selectStory = db.prepare<[number], { id: number }>('SELECT id FROM story WHERE id = ?')
  const selectSession = db.prepare<[string], { id: number }>(
    'SELECT id FROM agent_session WHERE claude_session_id = ?',
  )
  const selectSessionWithPhase = db.prepare<[string], { id: number; phase: AgentPhase }>(
    'SELECT id, phase FROM agent_session WHERE claude_session_id = ?',
  )
  const insertFinding = db.prepare<[number, number, ReviewLens, FindingSeverity, string, number | null, string]>(
    `INSERT INTO review_finding (story_id, agent_session_id, lens, severity, path, line, statement)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const selectFinding = db.prepare<[number], FindingRow>('SELECT * FROM review_finding WHERE id = ?')
  const selectUnresolvedFindings = db.prepare<[number], FindingRow>(
    'SELECT * FROM review_finding WHERE story_id = ? AND resolved_at IS NULL ORDER BY id',
  )
  const selectUnresolvedStrongCount = db.prepare<[number], { total: number }>(
    `SELECT COUNT(*) AS total FROM review_finding
      WHERE story_id = ? AND severity = 'strong' AND resolved_at IS NULL`,
  )
  const updateFindingResolved = db.prepare<[number]>(
    "UPDATE review_finding SET resolved_at = datetime('now') WHERE id = ?",
  )
  const selectPasses = db.prepare<[number], PassRow>(
    `SELECT review_pass.lens AS lens, review_pass.state AS state, agent_session.agent_name AS agent_name
       FROM review_pass
       LEFT JOIN agent_session ON agent_session.id = review_pass.agent_session_id
      WHERE review_pass.story_id = ?`,
  )
  const upsertPassRunning = db.prepare<[number, ReviewLens, number]>(
    `INSERT INTO review_pass (story_id, lens, state, agent_session_id, started_at)
     VALUES (?, ?, 'running', ?, datetime('now'))
     ON CONFLICT (story_id, lens)
       DO UPDATE SET state = 'running', agent_session_id = excluded.agent_session_id, started_at = datetime('now')`,
  )
  const updatePassPassed = db.prepare<[number, ReviewLens]>(
    `UPDATE review_pass SET state = 'passed', finished_at = datetime('now')
      WHERE story_id = ? AND lens = ?`,
  )
  const selectUnresolvedStrongForLens = db.prepare<[number, ReviewLens], { total: number }>(
    `SELECT COUNT(*) AS total FROM review_finding
      WHERE story_id = ? AND lens = ? AND severity = 'strong' AND resolved_at IS NULL`,
  )

  function reviewCascade(storyId: number): readonly ReviewPass[] {
    const rows = selectPasses.all(storyId)
    return REVIEW_LENS_SEQUENCE.map((lens) => {
      const row = rows.find((candidate) => candidate.lens === lens)
      return {
        lens,
        state: row?.state ?? 'pending',
        agentName: row?.agent_name ?? null,
      }
    })
  }

  function passOf(storyId: number, lens: ReviewLens): ReviewPass {
    const pass = reviewCascade(storyId).find((candidate) => candidate.lens === lens)
    if (pass === undefined) {
      throw new StoryNotFoundError(storyId)
    }
    return pass
  }

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
