import type Database from 'better-sqlite3'
import {
  CHECKPOINT_SEQUENCE,
  type Checkpoint,
  type CheckpointDraft,
  type CheckpointName,
  type DefinitionOfDoneStep,
} from './Checkpoint.js'
import {
  CheckpointAlreadyProvenError,
  CheckpointOutOfOrderError,
  CriteriaRequiredError,
  CriteriaUnmetError,
  EvidenceRequiredError,
  MutationSurvivedError,
  RedNotAssertedError,
  ReviewIncompleteError,
  TestsTamperedError,
  UnresolvedFindingError,
} from './CheckpointViolation.js'
import { StoryNotFoundError, TwinRequiredError } from '../Story/StoryViolation.js'
import { createReviewRepository, type ReviewRepository } from './ReviewRepository.js'
import { assertEvidencePath } from '../Evidence/EvidencePath.js'
import { assertEvidenceShape } from '../Evidence/EvidenceShape.js'
import { EvidenceUnreadableError, type EvidenceReader } from '../Evidence/EvidenceRead.js'
import { compareCensus, type TestCensus } from '../Tamper/TestCensus.js'
import type { MutationOutcome } from '../Mutation/Mutation.js'
import { describeSurvivor, filesWorthMutating, survivorsOf } from '../Mutation/MutationVerdict.js'
import type { TestReport } from '../RedProof/RedProof.js'
import { describeRedVerdict, redVerdictOf } from '../RedProof/RedVerdict.js'
import type { ThreadProof } from '../Conversation/Thread.js'

type CheckpointRow = {
  id: number
  story_id: number
  name: CheckpointName
  evidence_path: string
}

type ProofRow = {
  name: CheckpointName
  proven_at: string
  evidence_path: string
}

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
  const upsertCensus = db.prepare<[number, number, number, number]>(
    `INSERT INTO test_census (story_id, tests, skipped, tautologies) VALUES (?, ?, ?, ?)
     ON CONFLICT (story_id) DO UPDATE SET
       tests = excluded.tests,
       skipped = excluded.skipped,
       tautologies = excluded.tautologies,
       taken_at = datetime('now')`,
  )
  const selectCensus = db.prepare<[number], { tests: number; skipped: number; tautologies: number }>(
    'SELECT tests, skipped, tautologies FROM test_census WHERE story_id = ?',
  )
  const reviews = createReviewRepository(db)
  const selectStory = db.prepare<[number], { id: number; reference: string; kind: string }>(
    'SELECT id, reference, kind FROM story WHERE id = ?',
  )
  const selectTwin = db.prepare<[number], { id: number }>('SELECT id FROM story WHERE twin_of_story_id = ?')
  const selectCriteriaCount = db.prepare<[number], { total: number }>(
    'SELECT COUNT(*) AS total FROM acceptance_criterion WHERE story_id = ?',
  )
  const selectUnmetCriteria = db.prepare<[number], { reference: string }>(
    `SELECT reference FROM acceptance_criterion
      WHERE story_id = ? AND satisfied_at IS NULL
      ORDER BY reference`,
  )
  const insertCheckpoint = db.prepare<[number, CheckpointName, string]>(
    'INSERT INTO checkpoint (story_id, name, evidence_path) VALUES (?, ?, ?)',
  )
  const selectTouchedPaths = db.prepare<[number], { path: string }>(
    'SELECT DISTINCT path FROM file_touch WHERE story_id = ? ORDER BY path',
  )
  const selectCheckpoints = db.prepare<[number], CheckpointRow>(
    'SELECT * FROM checkpoint WHERE story_id = ?',
  )
  const selectProofs = db.prepare<[number], ProofRow>(
    'SELECT name, proven_at, evidence_path FROM checkpoint WHERE story_id = ? ORDER BY proven_at, id',
  )
  const deleteCheckpoint = db.prepare<[number, CheckpointName]>(
    'DELETE FROM checkpoint WHERE story_id = ? AND name = ?',
  )
  const deletePasses = db.prepare<[number]>('DELETE FROM review_pass WHERE story_id = ?')

  function provenNames(storyId: number): readonly CheckpointName[] {
    return selectCheckpoints.all(storyId).map((row) => row.name)
  }

  return {
    recordFinding: reviews.recordFinding,
    listUnresolvedFindings: reviews.listUnresolvedFindings,
    resolveFinding: reviews.resolveFinding,
    reviewCascade: reviews.reviewCascade,
    startLens: reviews.startLens,
    passLens: reviews.passLens,

    proveCheckpoint: (draft, options = {}) => {
      const story = selectStory.get(draft.storyId)
      if (story === undefined) {
        throw new StoryNotFoundError(draft.storyId)
      }
      if (draft.evidencePath.trim().length === 0) {
        throw new EvidenceRequiredError(draft.name)
      }
      const evidencePath = assertEvidencePath(draft.evidencePath)
      const root = checkoutOf?.(draft.storyId)
      const read = readEvidence(evidencePath, root)
      if (read.kind === 'unreadable') {
        throw new EvidenceUnreadableError(evidencePath, read.reason)
      }
      assertEvidenceShape(draft.name, evidencePath, read.content)

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

      if (draft.name === 'spec_done' && story.kind === 'functional' && options.waived !== true) {
        if (selectTwin.get(story.id) === undefined) {
          throw new TwinRequiredError(story.reference)
        }
        if ((selectCriteriaCount.get(story.id)?.total ?? 0) === 0) {
          throw new CriteriaRequiredError(story.reference)
        }
      }

      if (draft.name === 'tests_written' && options.redObservedByOrchestrator !== true) {
        const verdict = redVerdictOf(surveyRed(root))
        if (verdict.kind !== 'assertion') {
          throw new RedNotAssertedError(describeRedVerdict(verdict))
        }
      }

      if (draft.name === 'tests_written') {
        const taken = takeCensus(root)
        upsertCensus.run(draft.storyId, taken.tests, taken.skipped, taken.tautologies)
      }

      if (draft.name === 'build_done') {
        const touched = options.touchedPaths ?? selectTouchedPaths.all(draft.storyId).map((row) => row.path)
        const survivors = survivorsOf(surveyMutations(filesWorthMutating(touched), root))
        if (survivors.length > 0) {
          throw new MutationSurvivedError(survivors.map(describeSurvivor))
        }
      }

      if (draft.name === 'reviewed') {
        const written = selectCensus.get(draft.storyId)
        if (written === undefined) {
          throw new TestsTamperedError(["aucun recensement n'a ete pris a l'ecriture des tests"])
        }
        const drifted = compareCensus(written, takeCensus(root))
        if (drifted.length > 0) {
          throw new TestsTamperedError(drifted)
        }
      }

      if (draft.name === 'reviewed') {
        const unresolved = reviews.countUnresolvedStrongFindings(draft.storyId)
        if (unresolved > 0) {
          throw new UnresolvedFindingError(unresolved)
        }
        const pending = reviews.reviewCascade(draft.storyId)
          .filter((pass) => pass.state !== 'passed')
          .map((pass) => pass.lens)
        if (pending.length > 0) {
          throw new ReviewIncompleteError(pending)
        }
        const unmet = selectUnmetCriteria.all(draft.storyId).map((row) => row.reference)
        if (unmet.length > 0) {
          throw new CriteriaUnmetError(unmet)
        }
      }

      const info = insertCheckpoint.run(draft.storyId, draft.name, evidencePath)
      return {
        id: Number(info.lastInsertRowid),
        storyId: draft.storyId,
        name: draft.name,
        evidencePath,
      }
    },

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
        return {
          name,
          proven: row !== undefined,
          evidencePath: row?.evidence_path ?? null,
        }
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
