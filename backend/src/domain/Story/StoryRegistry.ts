import type { EpicRepository } from '../Epic/EpicRepository.js'
import type { Story, StoryState } from './Story.js'
import { toStory } from './StoryRows.js'
import type { StoryStatements } from './StoryStatements.js'
import { StoryNotFoundError } from './StoryViolation.js'

export type StoryRegistry = ReturnType<typeof createStoryRegistry>

export function createStoryRegistry(
  { selectStory, selectTwin, selectProjectSlug, countFunctionalStories, updateState }: StoryStatements,
  epics: Pick<EpicRepository, 'recordState'>,
) {
  function findStory(storyId: number): Story {
    const row = selectStory.get(storyId)
    if (row === undefined) {
      throw new StoryNotFoundError(storyId)
    }
    return toStory(row)
  }

  function findTwin(storyId: number): Story | null {
    const row = selectTwin.get(storyId)
    return row === undefined ? null : toStory(row)
  }

  function nextReference(epicId: number): string {
    const project = selectProjectSlug.get(epicId)
    if (project === undefined) {
      throw new StoryNotFoundError(epicId)
    }
    const written = countFunctionalStories.get(epicId)?.total ?? 0
    return `${project.slug.toUpperCase()}-${written + 1}`
  }

  function settle(story: Story): Story {
    epics.recordState(story.epicId)
    return story
  }

  function moveTo(storyId: number, state: StoryState): Story {
    updateState.run(state, state, storyId)
    return settle(findStory(storyId))
  }

  return { findStory, findTwin, nextReference, settle, moveTo }
}
