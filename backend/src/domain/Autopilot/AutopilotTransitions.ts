import { MAX_AUTO_TRANSITIONS } from '../../../../contract/AutopilotContract.js'
import type { ForgeCardClosed } from '../ForgeCard/ForgeCardCloser.js'
import { PublicationFailedError } from '../../technical/Git/StoryPublication.js'
import { handlingOf, messageOf, WAITING_BUDGET_REASON } from './AutopilotHandling.js'
import type { AutopilotCardState } from './AutopilotCardState.js'
import type { AutopilotConductorInput } from './AutopilotInput.js'
import type { AutopilotCardRecord } from './AutopilotRepository.js'
import type { StepVerifier } from './StepVerifier.js'

export type AutopilotTransitions = ReturnType<typeof createAutopilotTransitions>

export function createAutopilotTransitions(
  { autopilot, board, stories, columns, cwdOf, mover, closer, publish }: Pick<
    AutopilotConductorInput,
    'autopilot' | 'board' | 'stories' | 'columns' | 'cwdOf' | 'mover' | 'closer' | 'publish'
  >,
  { discard }: Pick<StepVerifier, 'discard'>,
  { announce, patch }: Pick<AutopilotCardState, 'announce' | 'patch'>,
) {
  function parkOnError(forgeCardId: number, error: unknown, keepPending: boolean): void {
    const handling = handlingOf(error)
    if (handling === 'red') {
      const publication = error instanceof PublicationFailedError
      patch(forgeCardId, {
        state: 'red',
        reason: messageOf(error),
        ...(publication && keepPending ? {} : { pending: null }),
      })
      return
    }
    patch(forgeCardId, {
      state: 'paused',
      reason: handling === 'budget' ? WAITING_BUDGET_REASON : 'Waiting for a free session slot',
    })
  }

  async function advance(forgeCardId: number): Promise<void> {
    const view = board.view(forgeCardId)
    const record = autopilot.cardOf(forgeCardId)
    if (record.advances >= MAX_AUTO_TRANSITIONS) {
      patch(forgeCardId, {
        state: 'red',
        pending: null,
        reason: `The card reached the limit of ${MAX_AUTO_TRANSITIONS} automatic transitions`,
      })
      return
    }
    const steps = columns.list(view.projectId, view.workflowId)
    const next = steps[steps.findIndex((step) => step.key === view.stepKey) + 1]
    if (next === undefined) {
      const closed: ForgeCardClosed = closer.close(forgeCardId)
      autopilot.resetCard(forgeCardId)
      publish?.('story.closed', { storyId: view.storyId, publication: closed.publication })
      return
    }
    const story = stories.findStory(view.storyId)
    discard(cwdOf(view.storyId), story.reference, next.key)
    const moved = await mover.move(forgeCardId, next.key)
    announce(moved)
    patch(forgeCardId, {
      stepKey: next.key,
      attempts: 0,
      advances: record.advances + 1,
      pending: null,
      state: null,
      reason: null,
      feedback: null,
    })
  }

  async function retry(forgeCardId: number, record: AutopilotCardRecord): Promise<void> {
    const view = board.view(forgeCardId)
    const story = stories.findStory(view.storyId)
    discard(cwdOf(view.storyId), story.reference, view.stepKey)
    const moved = await mover.launch(forgeCardId, record.feedback === null ? {} : { feedback: record.feedback })
    announce(moved)
    patch(forgeCardId, { pending: null, state: null, reason: null, feedback: null })
  }

  async function runPending(forgeCardId: number): Promise<void> {
    const record = autopilot.cardOf(forgeCardId)
    if (record.pending === null || record.state === 'red') {
      return
    }
    try {
      if (record.pending === 'retry') {
        await retry(forgeCardId, record)
      } else {
        await advance(forgeCardId)
      }
    } catch (error) {
      parkOnError(forgeCardId, error, record.pending === 'advance')
    }
  }

  return { runPending }
}
