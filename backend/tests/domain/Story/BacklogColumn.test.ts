import { describe, expect, it } from 'vitest'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { KANBAN_COLUMNS } from '../../../src/domain/Story/Story.js'

function boardWithOneWaitingStory() {
  const stories = createStoryRepository(openDatabase(':memory:'))
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'main',
    colour: 'acc',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'une epique',
    businessIntent: 'une intention',
  })
  const story = stories.writeStory({ epicId: epic.id, title: 'une story', body: 'un corps' })
  stories.writeTwin({ storyId: story.id, title: 'ses tests', body: 'ses cas' })
  return { stories, story }
}

describe('la reserve est une colonne', () => {
  it('ouvre le tableau, avant le plan', () => {
    expect(KANBAN_COLUMNS[0]?.key).toBe('backlog')
  })

  it('porte les stories qui attendent une session', () => {
    const { stories, story } = boardWithOneWaitingStory()

    stories.sendToBacklog(story.id)

    expect(stories.listKanban().map((one) => one.state)).toEqual(['backlog'])
  })

  it('laisse la redaction hors du tableau, elle n est pas une colonne', () => {
    const { stories } = boardWithOneWaitingStory()

    expect(stories.listKanban()).toEqual([])
  })
})
