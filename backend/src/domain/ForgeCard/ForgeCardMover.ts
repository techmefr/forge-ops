import { BACKLOG_STEP_KEY, DONE_STEP_KEY, type ForgeCardMoved } from '../../../../contract/ForgeCardContract.js'
import type { Dispatched, StepEntry } from '../Dispatch/Dispatch.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import type { ForgeBoardRepository } from './ForgeBoardRepository.js'
import { createForgeCardMoveSupport } from './ForgeCardMoveSupport.js'
import type { ForgeCardRepository } from './ForgeCardRepository.js'
import { stateOfStep } from './ForgeCardStatus.js'
import { DoneIsEarnedError, DoneIsFinalError, LaunchNeedsAStepError, StepBusyError } from './ForgeCardViolation.js'

export type ForgeCardMoverInput = {
  board: ForgeBoardRepository
  forgeCards: ForgeCardRepository
  stories: StoryRepository
  columns: WorkflowColumnRepository
  enterStep: (entry: StepEntry) => Promise<Dispatched | null>
  launchStep: (entry: StepEntry) => Promise<Dispatched>
}

export type ForgeCardMover = {
  move: (forgeCardId: number, stepKey: string) => Promise<ForgeCardMoved>
  launch: (forgeCardId: number, options?: { feedback?: string }) => Promise<ForgeCardMoved>
}

type CardView = ReturnType<ForgeBoardRepository['view']>

function assertMovable(view: CardView, busy: boolean, stepKey: string): void {
  if (busy || view.status === 'running') {
    throw new StepBusyError(view.reference)
  }
  if (view.stepKey === DONE_STEP_KEY) {
    throw new DoneIsFinalError(view.reference)
  }
  if (stepKey === DONE_STEP_KEY) {
    throw new DoneIsEarnedError(view.reference)
  }
}

function assertLaunchable(view: CardView, busy: boolean): void {
  if (view.stepKey === BACKLOG_STEP_KEY || view.stepKey === DONE_STEP_KEY) {
    throw new LaunchNeedsAStepError(view.reference)
  }
  if (busy || view.status === 'running') {
    throw new StepBusyError(view.reference)
  }
}

export function createForgeCardMover({
  board,
  forgeCards,
  stories,
  columns,
  enterStep,
  launchStep,
}: ForgeCardMoverInput): ForgeCardMover {
  const inFlight = new Set<number>()
  const { placementOfCard, restore, feedbackOf, stepOf, entryOf, moved } = createForgeCardMoveSupport(
    board,
    stories,
    columns,
  )

  async function guarded<T>(forgeCardId: number, work: () => Promise<T>): Promise<T> {
    inFlight.add(forgeCardId)
    try {
      return await work()
    } finally {
      inFlight.delete(forgeCardId)
    }
  }

  return {
    move: async (forgeCardId, stepKey) => {
      const view = board.view(forgeCardId)
      if (view.stepKey === stepKey) {
        return moved(forgeCardId, null)
      }
      assertMovable(view, inFlight.has(forgeCardId), stepKey)
      const card = forgeCards.findForgeCard(forgeCardId)
      const before = placementOfCard(card.storyIds)

      if (stepKey === BACKLOG_STEP_KEY) {
        for (const storyId of card.storyIds) {
          stories.moveToState(storyId, 'backlog')
        }
        return moved(forgeCardId, null)
      }

      const step = stepOf(view, stepKey)
      for (const storyId of card.storyIds) {
        stories.setPlacement(storyId, { state: stateOfStep(step.key), workflowColumnId: step.id })
      }
      return guarded(forgeCardId, async () => {
        try {
          return moved(forgeCardId, await enterStep(entryOf(view, step)))
        } catch (error) {
          restore(before)
          throw error
        }
      })
    },

    launch: async (forgeCardId, options = {}) => {
      const view = board.view(forgeCardId)
      assertLaunchable(view, inFlight.has(forgeCardId))
      const step = stepOf(view, view.stepKey)
      return guarded(forgeCardId, async () =>
        moved(forgeCardId, await launchStep({ ...entryOf(view, step), ...feedbackOf(options.feedback) })),
      )
    },
  }
}
