import { type ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import type { StepVerdict } from '../../../../contract/AutopilotContract.js'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import { contractOfPhase } from '../Dispatch/Dispatch.js'
import type { EvidenceReader } from '../Evidence/EvidenceRead.js'
import { phaseOfStep } from '../ForgeCard/ForgeCardStatus.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import { NEEDS_CRITERIA_REASON, createOwnCheckpointProof } from './StepOwnProof.js'
import type { StepProver } from './StepProver.js'
import { readVerdict, safeVerdictPath } from './StepVerdict.js'

export type StepOutcome =
  | { kind: 'pass' }
  | { kind: 'fail'; reason: string }
  | { kind: 'blocked'; reason: string }

export { NEEDS_CRITERIA_REASON }

export type StepVerifierInput = {
  stories: Pick<StoryRepository, 'findStory'>
  columns: WorkflowColumnRepository
  sessions: Pick<AgentSessionRepository, 'listRecentActivity'>
  checkpoints: Pick<CheckpointRepository, 'definitionOfDone' | 'proveCheckpoint'>
  readEvidence: EvidenceReader
  cwdOf: (storyId: number) => string
  clearVerdict: (root: string, verdictPath: string) => void
  prover?: StepProver
  baseShaOf?: (storyId: number) => string | null
  integrityOf?: (storyId: number) => string | null
  publish?: (name: string, payload: Record<string, unknown>) => void
}

export type StepVerifier = {
  verify: (view: ForgeCardView, step: WorkflowColumn) => StepOutcome
  discard: (root: string, storyReference: string, stepKey: string) => void
}

export function createStepVerifier({
  stories,
  columns,
  sessions,
  checkpoints,
  readEvidence,
  cwdOf,
  clearVerdict,
  prover,
  baseShaOf,
  integrityOf,
  publish,
}: StepVerifierInput): StepVerifier {
  function discard(root: string, storyReference: string, stepKey: string): void {
    const path = safeVerdictPath(storyReference, stepKey)
    if (path !== null) {
      clearVerdict(root, path)
    }
  }

  const proveOwnCheckpoint = createOwnCheckpointProof(columns, checkpoints, publish)

  function proveByOrchestrator(
    view: ForgeCardView,
    step: WorkflowColumn,
    storyReference: string,
    verdict: StepVerdict,
    activeProver: StepProver,
  ): StepOutcome {
    const keys = columns.list(view.projectId, view.workflowId).map((candidate) => candidate.key)
    const baseSha = baseShaOf?.(view.storyId) ?? null
    if (baseSha === null) {
      return { kind: 'fail', reason: 'The story has no live worktree to inspect, so nothing can be proven' }
    }
    const outcome = activeProver.prove({
      storyId: view.storyId,
      storyReference,
      root: cwdOf(view.storyId),
      baseSha,
      stepKey: step.key,
      proves: contractOfPhase(phaseOfStep(step.key, keys)).proves,
      verdict,
      workflowPhases: keys.map((key) => phaseOfStep(key, keys)),
    })
    if (outcome.kind === 'fail') {
      return outcome
    }
    for (const checkpoint of outcome.proven) {
      publish?.('checkpoint.proven', { ...checkpoint })
    }
    return { kind: 'pass' }
  }

  function verify(view: ForgeCardView, step: WorkflowColumn): StepOutcome {
    const breach = integrityOf?.(view.storyId) ?? null
    if (breach !== null) {
      return { kind: 'fail', reason: breach }
    }
    if (view.status === 'failed') {
      const latest = sessions.listRecentActivity(view.storyId, 1)[0]
      return { kind: 'fail', reason: `The agent session ended with ${latest?.outcome ?? 'an error'}` }
    }
    const story = stories.findStory(view.storyId)
    const root = cwdOf(view.storyId)
    const reading = readVerdict(readEvidence, root, story.reference, step.key)
    if (reading.kind === 'missing') {
      return { kind: 'fail', reason: `The agent did not write the step verdict at ${reading.path}` }
    }
    if (reading.kind === 'invalid') {
      return { kind: 'fail', reason: `The step verdict ${reading.path} is unusable: ${reading.reason}` }
    }
    discard(root, story.reference, step.key)
    if (reading.verdict.status === 'blocked') {
      return { kind: 'blocked', reason: reading.verdict.reason ?? 'The agent needs a human decision' }
    }
    if (reading.verdict.status === 'fail') {
      return { kind: 'fail', reason: reading.verdict.reason ?? 'The agent reported that the step failed' }
    }
    return prover === undefined
      ? proveOwnCheckpoint(view, step, story.reference)
      : proveByOrchestrator(view, step, story.reference, reading.verdict, prover)
  }

  return { verify, discard }
}
