import { BACKLOG_STEP_KEY, DONE_STEP_KEY, type ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import type { AutoCardView } from '../../../../contract/AutopilotContract.js'
import { WAITING_BUDGET_REASON } from './AutopilotHandling.js'
import type { AutopilotConductorInput } from './AutopilotInput.js'
import type { AutopilotLauncher } from './AutopilotLauncher.js'
import { NEEDS_CRITERIA_REASON } from './StepVerifier.js'

export function createAutopilotAutoView(
  { autopilot }: Pick<AutopilotConductorInput, 'autopilot'>,
  { lacksCriteria, backlogEntryOf, budgetBlocks }: Pick<AutopilotLauncher, 'lacksCriteria' | 'backlogEntryOf' | 'budgetBlocks'>,
) {
  function edgeViewOf(view: ForgeCardView): AutoCardView | null {
    const record = autopilot.cardOf(view.id)
    if (record.state === 'red') {
      return { state: 'red', reason: record.reason }
    }
    if (view.stepKey !== BACKLOG_STEP_KEY) {
      return null
    }
    if (lacksCriteria(view.storyId)) {
      return { state: 'paused', reason: NEEDS_CRITERIA_REASON }
    }
    if (backlogEntryOf(view.projectId, view.workflowId) !== null && budgetBlocks()) {
      return { state: 'paused', reason: WAITING_BUDGET_REASON }
    }
    return null
  }

  function statusViewOf(view: ForgeCardView): AutoCardView | null {
    if (view.status === 'budget_exhausted') {
      const reason = autopilot.settingsOf(view.projectId).autoLaunch ? WAITING_BUDGET_REASON : 'Budget exhausted, press Retry to resume'
      return { state: 'paused', reason }
    }
    if (view.status === 'stopped') {
      return { state: 'paused', reason: 'Stopped by a user, press Retry to resume' }
    }
    if (view.status === 'human_review') {
      return { state: 'paused', reason: 'Waiting for a human step' }
    }
    if (view.status === 'idle') {
      return { state: 'paused', reason: 'This step does not start automatically' }
    }
    return null
  }

  function autoViewOf(view: ForgeCardView): AutoCardView | null {
    if (!autopilot.settingsOf(view.projectId).enabled) {
      return null
    }
    if (view.stepKey === BACKLOG_STEP_KEY || view.stepKey === DONE_STEP_KEY) {
      return edgeViewOf(view)
    }
    const record = autopilot.cardOf(view.id)
    if (record.state === 'red') {
      return { state: 'red', reason: record.reason }
    }
    if (record.state === 'paused') {
      return { state: 'paused', reason: record.reason }
    }
    if (view.status === 'running' || record.pending !== null) {
      return { state: 'running', reason: null }
    }
    return statusViewOf(view)
  }

  return { autoViewOf }
}
