import type Database from 'better-sqlite3'
import {
  CHECKPOINT_SEQUENCE,
  type Checkpoint,
  type CheckpointDraft,
  type CheckpointName,
  type DefinitionOfDoneStep,
} from './Checkpoint.js'
import { CheckpointAlreadyProvenError, CheckpointOutOfOrderError, EvidenceRequiredError } from './CheckpointViolation.js'
import { createProofGates } from './CheckpointGates.js'
import { prepareCheckpointStatements } from './CheckpointStatements.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'
import { createReviewRepository, type ReviewRepository } from './ReviewRepository.js'
import { assertEvidencePath } from '../Evidence/EvidencePath.js'
import { assertEvidenceShape } from '../Evidence/EvidenceShape.js'
import { EvidenceUnreadableError, type EvidenceReader } from '../Evidence/EvidenceRead.js'
import type { TestCensus } from '../Tamper/TestCensus.js'
import type { MutationOutcome } from '../Mutation/Mutation.js'
import type { TestReport } from '../RedProof/RedProof.js'
import type { ThreadProof } from '../Conversation/Thread.js'

export type ProofOptions = {
  redObservedByOrchestrator?: boolean
  touchedPaths?: readonly string[]
  waived?: boolean
}

export type CheckpointRepository = Omit<ReviewRepository, 'countUnresolvedStrongFindings'> & {
  proveCheckpoint: (draft: CheckpointDraft, options?: ProofOptions) => Checkpoint
  revokeCheckpoints: (storyId: number, names: readonly CheckpointName[]) => readonly CheckpointName[]
  definitionOfDone: (storyId: number) => readonly DefinitionOfDoneStep[]
  listProofs: (storyId: number) => readonly ThreadProof[]
}

export type CheckpointRepositoryInput = {
  takeCensus: (root?: string) => TestCensus
  readEvidence: EvidenceReader
  surveyMutations: (paths: readonly string[], root?: string) => readonly MutationOutcome[]
  surveyRed: (root?: string) => TestReport
  checkoutOf?: (storyId: number) => string
}

export function createCheckpointRepository(
  db: Database.Database,
  { takeCensus, readEvidence, surveyMutations, surveyRed, checkoutOf }: CheckpointRepositoryInput,
): CheckpointRepository {
  const statements = prepareCheckpointStatements(db)
  const { selectStory, insertCheckpoint, selectCheckpoints, selectProofs, deleteCheckpoint, deletePasses } = statements
  const reviews = createReviewRepository(db)
  const { assertGate } = createProofGates({ takeCensus, surveyMutations, surveyRed }, statements, reviews)

  function provenNames(storyId: number): readonly CheckpointName[] {
    return selectCheckpoints.all(storyId).map((row) => row.name)
  }

  function readProof(draft: CheckpointDraft, root: string | undefined): string {
    if (draft.evidencePath.trim().length === 0) {
      throw new EvidenceRequiredError(draft.name)
    }
    const evidencePath = assertEvidencePath(draft.evidencePath)
    const read = readEvidence(evidencePath, root)
    if (read.kind === 'unreadable') {
      throw new EvidenceUnreadableError(evidencePath, read.reason)
    }
    assertEvidenceShape(draft.name, evidencePath, read.content)
    return evidencePath
  }

  function assertInOrder(draft: CheckpointDraft): void {
    const proven = provenNames(draft.storyId)
    if (proven.includes(draft.name)) {
      throw new CheckpointAlreadyProvenError(draft.name)
    }
    const missing = CHECKPOINT_SEQUENCE.slice(0, CHECKPOINT_SEQUENCE.indexOf(draft.name)).filter(
      (name) => !proven.includes(name),
    )
    if (missing.length > 0) {
      throw new CheckpointOutOfOrderError(draft.name, missing)
    }
  }

  function proveCheckpoint(draft: CheckpointDraft, options: ProofOptions = {}): Checkpoint {
    const story = selectStory.get(draft.storyId)
    if (story === undefined) {
      throw new StoryNotFoundError(draft.storyId)
    }
    const root = checkoutOf?.(draft.storyId)
    const evidencePath = readProof(draft, root)
    assertInOrder(draft)
    assertGate(story, draft, options, root)
    const info = insertCheckpoint.run(draft.storyId, draft.name, evidencePath)
    return { id: Number(info.lastInsertRowid), storyId: draft.storyId, name: draft.name, evidencePath }
  }

  return {
    recordFinding: reviews.recordFinding,
    listUnresolvedFindings: reviews.listUnresolvedFindings,
    resolveFinding: reviews.resolveFinding,
    reviewCascade: reviews.reviewCascade,
    startLens: reviews.startLens,
    passLens: reviews.passLens,
    proveCheckpoint,

    revokeCheckpoints: (storyId, names) => {
      const proven = provenNames(storyId)
      const revoked = names.filter((name) => proven.includes(name))
      for (const name of revoked) {
        deleteCheckpoint.run(storyId, name)
      }
      if (names.includes('verified')) {
        deletePasses.run(storyId)
      }
      return revoked
    },

    definitionOfDone: (storyId) => {
      const rows = selectCheckpoints.all(storyId)
      return CHECKPOINT_SEQUENCE.map((name) => {
        const row = rows.find((candidate) => candidate.name === name)
        return { name, proven: row !== undefined, evidencePath: row?.evidence_path ?? null }
      })
    },

    listProofs: (storyId) =>
      selectProofs.all(storyId).map((row) => ({
        name: row.name,
        provenAt: row.proven_at,
        evidencePath: row.evidence_path,
      })),
  }
}
