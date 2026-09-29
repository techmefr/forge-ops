import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createWorkflowColumnRepository } from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import { createForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import {
  createForgeBoardRepository,
  type ForgeBoardRepository,
} from '../../../src/domain/ForgeCard/ForgeBoardRepository.js'

let db: Database.Database
let stories: StoryRepository
let board: ForgeBoardRepository
let projectId: number
let epicId: number

function cardCount(): number {
  return (db.prepare('SELECT COUNT(*) AS total FROM forge_card').get() as { total: number }).total
}

function storyIn(state: 'drafting' | 'backlog'): number {
  const story = stories.writeStory({ epicId, title: 'see the mails', body: 'body' })
  stories.writeTwin({ storyId: story.id, title: 'tests', body: 'cases' })
  if (state === 'backlog') {
    stories.sendToBacklog(story.id)
  }
  return story.id
}

beforeEach(() => {
  db = openDatabase(':memory:')
  const forgeCards = createForgeCardRepository(db)
  stories = createStoryRepository(db, { onBacklog: (story) => forgeCards.attachCardToStory(story.id) })
  board = createForgeBoardRepository(db, { forgeCards, columns: createWorkflowColumnRepository(db) })
  projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  epicId = stories.createEpic({ projectId, title: 'CRUD Mail', businessIntent: 'manage' }).id
})

describe('when a card comes to exist', () => {
  it('creates it the moment the story enters the backlog, once', () => {
    const id = storyIn('backlog')

    expect(cardCount()).toBe(1)
    expect(board.list(projectId).map((card) => card.storyId)).toEqual([id])
  })

  it('does not create it while the story is still being written', () => {
    storyIn('drafting')

    expect(cardCount()).toBe(0)
  })

  it('never creates or changes anything by listing the board', () => {
    const plain = createStoryRepository(db)
    const story = plain.writeStory({ epicId, title: 'legacy', body: 'body' })
    plain.writeTwin({ storyId: story.id, title: 'tests', body: 'cases' })
    plain.sendToBacklog(story.id)

    expect(board.list(projectId)).toEqual([])
    expect(cardCount()).toBe(0)
  })

  it('backfills the cards of stories that predate the rule, exactly once', () => {
    const plain = createStoryRepository(db)
    const story = plain.writeStory({ epicId, title: 'legacy', body: 'body' })
    plain.writeTwin({ storyId: story.id, title: 'tests', body: 'cases' })
    plain.sendToBacklog(story.id)

    expect(board.backfillCards()).toBe(1)
    expect(board.backfillCards()).toBe(0)
    expect(board.list(projectId)).toHaveLength(1)
  })
})
