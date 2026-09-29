import { DONE_STEP_KEY, type ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import type { MergeCleanupReport } from '../Deployment/MergeCleanup.js'
import { assertDoneEarned, STATE_BEFORE_DONE } from '../Story/DoneGate.js'
import type { Story } from '../Story/Story.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import type { ForgeBoardRepository } from './ForgeBoardRepository.js'
import type { ForgeCardRepository } from './ForgeCardRepository.js'
import { DoneIsFinalError, NotAtLastStepError, StepBusyError } from './ForgeCardViolation.js'

export type ForgeCardClosed = {
  card: ForgeCardView
  unblocked: readonly Story[]
  cleanUp: MergeCleanupReport
}

export type ForgeCardCloserInput = {
  board: ForgeBoardRepository
  forgeCards: ForgeCardRepository
  stories: StoryRepository
  columns: WorkflowColumnRepository
  checkpoints: Pick<CheckpointRepository, 'definitionOfDone' | 'reviewCascade' | 'listUnresolvedFindings'>
  criteria: Pick<CriterionRepository, 'listCriteria'>
  cleanUpAfterMerge: (storyId: number) => MergeCleanupReport
}

export type ForgeCardCloser = {
  close: (forgeCardId: number) => ForgeCardClosed
}

export function createForgeCardCloser({
  board,
  forgeCards,
  stories,
  columns,
  checkpoints,
  criteria,
  cleanUpAfterMerge,
}: ForgeCardCloserInput): ForgeCardCloser {
  return {
    close: (forgeCardId) => {
      const view = board.view(forgeCardId)
      if (view.stepKey === DONE_STEP_KEY) {
        throw new DoneIsFinalError(view.reference)
      }
      if (view.status === 'running') {
        throw new StepBusyError(view.reference)
      }
      const steps = columns.list(view.projectId)
      if (steps[steps.length - 1]?.key !== view.stepKey) {
        throw new NotAtLastStepError(view.reference)
      }
      const story = stories.findStory(view.storyId)
      assertDoneEarned(story.reference, {
        state: STATE_BEFORE_DONE,
        definitionOfDone: checkpoints.definitionOfDone(story.id),
        cascade: checkpoints.reviewCascade(story.id),
        unresolvedFindings: checkpoints.listUnresolvedFindings(story.id),
        businessIntent: stories.findEpic(story.epicId).businessIntent,
        criteria: criteria.listCriteria(story.id),
      })
      const unblocked = stories.markDoneAndUnblock(story.id)
      const cleanUp = cleanUpAfterMerge(story.id)
      forgeCards.closeForgeCard(forgeCardId)
      return { card: board.view(forgeCardId), unblocked, cleanUp }
    },
  }
}
