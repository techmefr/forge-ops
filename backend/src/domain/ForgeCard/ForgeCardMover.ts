import {
  BACKLOG_STEP_KEY,
  DONE_STEP_KEY,
  type ForgeCardMoved,
  type ForgeCardView,
} from '../../../../contract/ForgeCardContract.js'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { Dispatched, StepEntry } from '../Dispatch/Dispatch.js'
import type { StoryPlacement, StoryRepository } from '../Story/StoryRepository.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import type { ForgeBoardRepository } from './ForgeBoardRepository.js'
import type { ForgeCardRepository } from './ForgeCardRepository.js'
import { phaseOfStep, stateOfStep } from './ForgeCardStatus.js'
import {
  DoneIsEarnedError,
  DoneIsFinalError,
  LaunchNeedsAStepError,
  StepBusyError,
  UnknownStepKeyError,
} from './ForgeCardViolation.js'

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
  launch: (forgeCardId: number) => Promise<ForgeCardMoved>
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

  function placementOfCard(storyIds: readonly number[]): ReadonlyMap<number, StoryPlacement> {
    return new Map(storyIds.map((storyId) => [storyId, board.placementOf(storyId)]))
  }

  function restore(placements: ReadonlyMap<number, StoryPlacement>): void {
    for (const [storyId, placement] of placements) {
      stories.setPlacement(storyId, placement)
    }
  }

  function stepOf(view: ForgeCardView, stepKey: string): WorkflowColumn {
    const step = columns.list(view.projectId).find((candidate) => candidate.key === stepKey)
    if (step === undefined) {
      throw new UnknownStepKeyError(stepKey)
    }
    return step
  }

  function entryOf(view: ForgeCardView, step: WorkflowColumn): StepEntry {
    return {
      storyId: view.storyId,
      columnId: step.id,
      phase: phaseOfStep(
        step.key,
        columns.list(view.projectId).map((candidate) => candidate.key),
      ),
    }
  }

  async function guarded<T>(forgeCardId: number, work: () => Promise<T>): Promise<T> {
    inFlight.add(forgeCardId)
    try {
      return await work()
    } finally {
      inFlight.delete(forgeCardId)
    }
  }

  function moved(forgeCardId: number, dispatched: Dispatched | null): ForgeCardMoved {
    return {
      card: board.view(forgeCardId),
      started: dispatched !== null,
      claudeSessionId: dispatched?.claudeSessionId ?? null,
    }
  }

  return {
    move: async (forgeCardId, stepKey) => {
      const view = board.view(forgeCardId)
      if (view.stepKey === stepKey) {
        return moved(forgeCardId, null)
      }
      if (inFlight.has(forgeCardId) || view.status === 'running') {
        throw new StepBusyError(view.reference)
      }
      if (view.stepKey === DONE_STEP_KEY) {
        throw new DoneIsFinalError(view.reference)
      }
      if (stepKey === DONE_STEP_KEY) {
        throw new DoneIsEarnedError(view.reference)
      }
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

    launch: async (forgeCardId) => {
      const view = board.view(forgeCardId)
      if (view.stepKey === BACKLOG_STEP_KEY || view.stepKey === DONE_STEP_KEY) {
        throw new LaunchNeedsAStepError(view.reference)
      }
      if (inFlight.has(forgeCardId) || view.status === 'running') {
        throw new StepBusyError(view.reference)
      }
      const step = stepOf(view, view.stepKey)
      return guarded(forgeCardId, async () => moved(forgeCardId, await launchStep(entryOf(view, step))))
    },
  }
}
