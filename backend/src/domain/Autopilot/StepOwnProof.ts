import type { ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import {
  CheckpointAlreadyProvenError,
  CheckpointOutOfOrderError,
  CriteriaRequiredError,
} from '../Checkpoint/CheckpointViolation.js'
import { contractOfPhase } from '../Dispatch/Dispatch.js'
import { phaseOfStep } from '../ForgeCard/ForgeCardStatus.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import { proofPathOf } from './StepBrief.js'
import type { StepOutcome } from './StepVerifier.js'

export const NEEDS_CRITERIA_REASON = 'Needs acceptance criteria'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createOwnCheckpointProof(
  columns: WorkflowColumnRepository,
  checkpoints: Pick<CheckpointRepository, 'definitionOfDone' | 'proveCheckpoint'>,
  publish: ((name: string, payload: Record<string, unknown>) => void) | undefined,
) {
  return (view: ForgeCardView, step: WorkflowColumn, storyReference: string): StepOutcome => {
    const keys = columns.list(view.projectId, view.workflowId).map((candidate) => candidate.key)
    const proves = contractOfPhase(phaseOfStep(step.key, keys)).proves
    if (proves === null) {
      return { kind: 'pass' }
    }
    const proven = checkpoints.definitionOfDone(view.storyId).find((entry) => entry.name === proves)?.proven === true
    if (proven) {
      return { kind: 'pass' }
    }
    try {
      const checkpoint = checkpoints.proveCheckpoint({
        storyId: view.storyId,
        name: proves,
        evidencePath: proofPathOf(storyReference, proves),
      })
      publish?.('checkpoint.proven', { ...checkpoint })
      return { kind: 'pass' }
    } catch (error) {
      if (error instanceof CheckpointOutOfOrderError || error instanceof CheckpointAlreadyProvenError) {
        return { kind: 'pass' }
      }
      if (error instanceof CriteriaRequiredError) {
        return { kind: 'blocked', reason: NEEDS_CRITERIA_REASON }
      }
      return { kind: 'fail', reason: messageOf(error) }
    }
  }
}
