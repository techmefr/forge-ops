import type { ForgeCardMoved, ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { Dispatched, StepEntry } from '../Dispatch/Dispatch.js'
import type { StoryPlacement, StoryRepository } from '../Story/StoryRepository.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import type { ForgeBoardRepository } from './ForgeBoardRepository.js'
import { phaseOfStep } from './ForgeCardStatus.js'
import { UnknownStepKeyError } from './ForgeCardViolation.js'

export function createForgeCardMoveSupport(
  board: ForgeBoardRepository,
  stories: StoryRepository,
  columns: WorkflowColumnRepository,
) {
  return {
    placementOfCard: (storyIds: readonly number[]): ReadonlyMap<number, StoryPlacement> =>
      new Map(storyIds.map((storyId) => [storyId, board.placementOf(storyId)])),

    restore: (placements: ReadonlyMap<number, StoryPlacement>): void => {
      for (const [storyId, placement] of placements) {
        stories.setPlacement(storyId, placement)
      }
    },

    feedbackOf: (feedback: string | undefined): { feedback?: string } =>
      feedback === undefined ? {} : { feedback },

    stepOf: (view: ForgeCardView, stepKey: string): WorkflowColumn => {
      const step = columns.list(view.projectId, view.workflowId).find((candidate) => candidate.key === stepKey)
      if (step === undefined) {
        throw new UnknownStepKeyError(stepKey)
      }
      return step
    },

    entryOf: (view: ForgeCardView, step: WorkflowColumn): StepEntry => ({
      storyId: view.storyId,
      columnId: step.id,
      phase: phaseOfStep(
        step.key,
        columns.list(view.projectId, view.workflowId).map((candidate) => candidate.key),
      ),
    }),

    moved: (forgeCardId: number, dispatched: Dispatched | null): ForgeCardMoved => ({
      card: board.view(forgeCardId),
      started: dispatched !== null,
      claudeSessionId: dispatched?.claudeSessionId ?? null,
    }),
  }
}
