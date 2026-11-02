import type { ForgeCardMoved, ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import type { AutopilotCardPatch, AutopilotCardRecord } from './AutopilotRepository.js'
import type { AutopilotConductorInput } from './AutopilotInput.js'

const PREVIOUS_OUTPUT_LIMIT = 1500

export type AutopilotCardState = ReturnType<typeof createAutopilotCardState>

export function createAutopilotCardState({
  autopilot,
  publish,
  lastAgentMessage,
}: Pick<AutopilotConductorInput, 'autopilot' | 'publish' | 'lastAgentMessage'>) {
  function announce(moved: ForgeCardMoved): void {
    if (moved.started && moved.claudeSessionId !== null) {
      publish?.('session.dispatched', {
        storyId: moved.card.storyId,
        reference: moved.card.storyReference,
        claudeSessionId: moved.claudeSessionId,
      })
    }
  }

  function recordOf(view: ForgeCardView): AutopilotCardRecord {
    const record = autopilot.cardOf(view.id)
    if (record.stepKey === view.stepKey) {
      return record
    }
    return autopilot.patchCard(view.id, { stepKey: view.stepKey, attempts: 0, state: null, reason: null })
  }

  function patch(forgeCardId: number, change: AutopilotCardPatch): AutopilotCardRecord {
    const next = autopilot.patchCard(forgeCardId, change)
    publish?.('autopilot.changed', { forgeCardId, state: next.state, reason: next.reason, pending: next.pending })
    return next
  }

  function feedbackOf(reason: string, storyId: number): string {
    const message = lastAgentMessage(storyId)
    const output = message === null ? '' : message.slice(-PREVIOUS_OUTPUT_LIMIT)
    return output === '' ? reason : `${reason}\n\nYour previous output ended with:\n${output}`
  }

  return { announce, recordOf, patch, feedbackOf }
}
