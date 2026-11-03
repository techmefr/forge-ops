import type { CheckpointDraft } from './Checkpoint.js'
import {
  CriteriaRequiredError,
  CriteriaUnmetError,
  MutationSurvivedError,
  RedNotAssertedError,
  ReviewIncompleteError,
  TestsTamperedError,
  UnresolvedFindingError,
} from './CheckpointViolation.js'
import type { CheckpointRepositoryInput, ProofOptions } from './CheckpointRepository.js'
import type { CheckpointStatements } from './CheckpointStatements.js'
import type { ReviewRepository } from './ReviewRepository.js'
import { TwinRequiredError } from '../Story/StoryViolation.js'
import { compareCensus } from '../Tamper/TestCensus.js'
import { describeSurvivor, filesWorthMutating, survivorsOf } from '../Mutation/MutationVerdict.js'
import { describeRedVerdict, redVerdictOf } from '../RedProof/RedVerdict.js'

type StoryHead = { id: number; reference: string; kind: string }

type GateInput = Pick<CheckpointRepositoryInput, 'takeCensus' | 'surveyMutations' | 'surveyRed'>

type ReviewGateReader = Pick<ReviewRepository, 'countUnresolvedStrongFindings' | 'reviewCascade'>

type ReviewGateDeps = {
  takeCensus: GateInput['takeCensus']
  statements: CheckpointStatements
  reviews: ReviewGateReader
}

function assertReviewed({ takeCensus, statements, reviews }: ReviewGateDeps, draft: CheckpointDraft, root: string | undefined): void {
  const written = statements.selectCensus.get(draft.storyId)
  if (written === undefined) {
    throw new TestsTamperedError(["aucun recensement n'a ete pris a l'ecriture des tests"])
  }
  const drifted = compareCensus(written, takeCensus(root))
  if (drifted.length > 0) {
    throw new TestsTamperedError(drifted)
  }
  const unresolved = reviews.countUnresolvedStrongFindings(draft.storyId)
  if (unresolved > 0) {
    throw new UnresolvedFindingError(unresolved)
  }
  const pending = reviews
    .reviewCascade(draft.storyId)
    .filter((pass) => pass.state !== 'passed')
    .map((pass) => pass.lens)
  if (pending.length > 0) {
    throw new ReviewIncompleteError(pending)
  }
  const unmet = statements.selectUnmetCriteria.all(draft.storyId).map((row) => row.reference)
  if (unmet.length > 0) {
    throw new CriteriaUnmetError(unmet)
  }
}

export function createProofGates(
  { takeCensus, surveyMutations, surveyRed }: GateInput,
  statements: CheckpointStatements,
  reviews: ReviewGateReader,
) {
  const { upsertCensus, selectTwin, selectCriteriaCount, selectTouchedPaths } = statements

  function assertSpecDone(story: StoryHead, options: ProofOptions): void {
    if (story.kind !== 'functional' || options.waived === true) {
      return
    }
    if (selectTwin.get(story.id) === undefined) {
      throw new TwinRequiredError(story.reference)
    }
    if ((selectCriteriaCount.get(story.id)?.total ?? 0) === 0) {
      throw new CriteriaRequiredError(story.reference)
    }
  }

  function assertTestsWritten(draft: CheckpointDraft, options: ProofOptions, root: string | undefined): void {
    if (options.redObservedByOrchestrator !== true) {
      const verdict = redVerdictOf(surveyRed(root))
      if (verdict.kind !== 'assertion') {
        throw new RedNotAssertedError(describeRedVerdict(verdict))
      }
    }
    const taken = takeCensus(root)
    upsertCensus.run(draft.storyId, taken.tests, taken.skipped, taken.tautologies)
  }

  function assertBuildDone(draft: CheckpointDraft, options: ProofOptions, root: string | undefined): void {
    const touched = options.touchedPaths ?? selectTouchedPaths.all(draft.storyId).map((row) => row.path)
    const survivors = survivorsOf(surveyMutations(filesWorthMutating(touched), root))
    if (survivors.length > 0) {
      throw new MutationSurvivedError(survivors.map(describeSurvivor))
    }
  }

  function assertGate(story: StoryHead, draft: CheckpointDraft, options: ProofOptions, root: string | undefined): void {
    if (draft.name === 'spec_done') {
      assertSpecDone(story, options)
    } else if (draft.name === 'tests_written') {
      assertTestsWritten(draft, options, root)
    } else if (draft.name === 'build_done') {
      assertBuildDone(draft, options, root)
    } else if (draft.name === 'reviewed') {
      assertReviewed({ takeCensus, statements, reviews }, draft, root)
    }
  }

  return { assertGate }
}
