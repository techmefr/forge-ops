import type { Story, StoryDraft, TwinDraft } from './Story.js'
import type { StoryRegistry } from './StoryRegistry.js'
import type { StoryStatements } from './StoryStatements.js'
import {
  EmptyCardError,
  PointsOutOfRangeError,
  RolloutOutOfRangeError,
  TwinAlreadyWrittenError,
  TwinOfTwinError,
  TwinRequiredError,
} from './StoryViolation.js'

export function createStoryAuthoring(
  { insertStory, selectTwin, updateCard, updatePoints, updateRollout }: StoryStatements,
  { findStory, nextReference, settle, moveTo }: StoryRegistry,
  onBacklog: ((story: Story) => void) | undefined,
) {
  return {
    writeStory: (draft: StoryDraft): Story => {
      const info = insertStory.run(draft.epicId, null, nextReference(draft.epicId), draft.title, draft.body, 'functional')
      return settle(findStory(Number(info.lastInsertRowid)))
    },

    writeTwin: (draft: TwinDraft): Story => {
      const story = findStory(draft.storyId)
      if (story.kind === 'test') {
        throw new TwinOfTwinError(story.reference)
      }
      if (selectTwin.get(story.id) !== undefined) {
        throw new TwinAlreadyWrittenError(story.reference)
      }
      const info = insertStory.run(story.epicId, story.id, `${story.reference}-T`, draft.title, draft.body, 'test')
      return findStory(Number(info.lastInsertRowid))
    },

    sendToBacklog: (storyId: number): Story => {
      const story = findStory(storyId)
      const twin = selectTwin.get(story.id)
      if (story.kind === 'functional' && twin === undefined) {
        throw new TwinRequiredError(story.reference)
      }
      if (twin !== undefined) {
        moveTo(twin.id, 'backlog')
      }
      const backlogged = moveTo(story.id, 'backlog')
      if (backlogged.kind === 'functional') {
        onBacklog?.(backlogged)
      }
      return backlogged
    },

    editStory: (storyId: number, draft: { title: string; body: string }): Story => {
      const story = findStory(storyId)
      const title = draft.title.trim()
      const body = draft.body.trim()
      if (title === '' || body === '') {
        throw new EmptyCardError(story.reference)
      }
      updateCard.run(title, body, story.id)
      return findStory(story.id)
    },

    estimate: (storyId: number, points: number): Story => {
      const story = findStory(storyId)
      if (!Number.isInteger(points) || points <= 0) {
        throw new PointsOutOfRangeError(points)
      }
      updatePoints.run(points, story.id)
      return findStory(story.id)
    },

    rollOut: (storyId: number, percent: number): Story => {
      const story = findStory(storyId)
      if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
        throw new RolloutOutOfRangeError(percent)
      }
      updateRollout.run(percent, story.id)
      return settle(findStory(story.id))
    },
  }
}
