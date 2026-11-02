import type { Story, StoryState } from './Story.js'
import type { DependencyRepository } from './DependencyRepository.js'
import type { StepBackDraft, StepBackRecord } from './StepBack.js'
import type { StepBackRepository } from './StepBackRepository.js'
import type { StoryRegistry } from './StoryRegistry.js'
import type { StoryStatements } from './StoryStatements.js'
import { BlockedByDependencyError, EmptyBlockedReasonError } from './StoryViolation.js'

export type StoryPlacement = {
  state: StoryState
  workflowColumnId: number | null
}

export function createStoryFlow(
  { updatePlacement, updateMergeConflict, updateBlockedReason }: StoryStatements,
  { findStory, settle, moveTo }: StoryRegistry,
  dependencies: Pick<DependencyRepository, 'listBlockers' | 'listFreedBy'>,
  stepBacks: Pick<StepBackRepository, 'record'>,
) {
  return {
    markDoneAndUnblock: (storyId: number): readonly Story[] => {
      moveTo(storyId, 'done')
      return dependencies.listFreedBy(storyId).map(findStory)
    },

    startBuilding: (storyId: number): Story => {
      const story = findStory(storyId)
      const blockers = dependencies.listBlockers(story.id)
      if (blockers.length > 0) {
        throw new BlockedByDependencyError(story.reference, blockers)
      }
      return moveTo(story.id, 'building')
    },

    moveToState: (storyId: number, state: StoryState): Story => moveTo(findStory(storyId).id, state),

    setPlacement: (storyId: number, placement: StoryPlacement): Story => {
      const story = findStory(storyId)
      updatePlacement.run(placement.state, placement.workflowColumnId, story.id)
      return findStory(story.id)
    },

    stepBack: (draft: StepBackDraft): StepBackRecord => {
      const story = findStory(draft.storyId)
      const record = stepBacks.record(draft, story.state)
      moveTo(story.id, draft.toState)
      return record
    },

    markMergeConflict: (storyId: number): Story => {
      const story = findStory(storyId)
      updateMergeConflict.run(1, story.id)
      return findStory(story.id)
    },

    clearMergeConflict: (storyId: number): Story => {
      const story = findStory(storyId)
      updateMergeConflict.run(0, story.id)
      return findStory(story.id)
    },

    blockStory: (storyId: number, reason: string): Story => {
      const story = findStory(storyId)
      const trimmed = reason.trim()
      if (trimmed === '') {
        throw new EmptyBlockedReasonError(story.reference)
      }
      updateBlockedReason.run(trimmed, story.id)
      return settle(findStory(story.id))
    },

    unblockStory: (storyId: number): Story => {
      const story = findStory(storyId)
      updateBlockedReason.run(null, story.id)
      return settle(findStory(story.id))
    },
  }
}
