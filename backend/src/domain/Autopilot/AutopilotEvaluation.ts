import { BACKLOG_STEP_KEY, DONE_STEP_KEY } from '../../../../contract/ForgeCardContract.js'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { AutopilotCardState } from './AutopilotCardState.js'
import type { AutopilotConductorInput } from './AutopilotInput.js'
import type { AutopilotTransitions } from './AutopilotTransitions.js'
import type { StepVerifier } from './StepVerifier.js'

export function createAutopilotEvaluation(
  { autopilot, board, columns }: Pick<AutopilotConductorInput, 'autopilot' | 'board' | 'columns'>,
  { verify }: Pick<StepVerifier, 'verify'>,
  { recordOf, patch, feedbackOf }: Pick<AutopilotCardState, 'recordOf' | 'patch' | 'feedbackOf'>,
  { runPending }: Pick<AutopilotTransitions, 'runPending'>,
) {
  function evaluableStepOf(forgeCardId: number): WorkflowColumn | null {
    const view = board.view(forgeCardId)
    if (!autopilot.settingsOf(view.projectId).enabled) {
      return null
    }
    if (view.stepKey === BACKLOG_STEP_KEY || view.stepKey === DONE_STEP_KEY) {
      return null
    }
    const step = columns.list(view.projectId, view.workflowId).find((candidate) => candidate.key === view.stepKey)
    if (step === undefined || step.provider === 'human') {
      return null
    }
    return view.status === 'to_validate' || view.status === 'failed' ? step : null
  }

  function describeFailure(step: WorkflowColumn, reason: string): string {
    const retried = step.maxRetries > 0 ? ` after ${step.maxRetries} ${step.maxRetries === 1 ? 'retry' : 'retries'}` : ''
    return `${step.label} failed${retried}: ${reason}`
  }

  async function evaluate(forgeCardId: number): Promise<void> {
    const step = evaluableStepOf(forgeCardId)
    if (step === null) {
      return
    }
    const view = board.view(forgeCardId)
    const record = recordOf(view)
    if (record.pending !== null || record.state === 'red') {
      return
    }
    const outcome = verify(view, step)
    if (outcome.kind === 'blocked') {
      patch(forgeCardId, { state: 'paused', reason: `Blocked: ${outcome.reason}`, pending: null })
      return
    }
    if (outcome.kind === 'pass') {
      patch(forgeCardId, { attempts: 0, state: null, reason: null, pending: 'advance', feedback: null })
    } else if (record.attempts < step.maxRetries) {
      patch(forgeCardId, {
        attempts: record.attempts + 1,
        state: null,
        reason: null,
        pending: 'retry',
        feedback: feedbackOf(outcome.reason, view.storyId),
      })
    } else {
      patch(forgeCardId, { state: 'red', pending: null, reason: describeFailure(step, outcome.reason) })
      return
    }
    await runPending(forgeCardId)
  }

  return { evaluate }
}
