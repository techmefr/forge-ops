import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'

let db: Database.Database
let stories: StoryRepository
let projectId: number
let epicId: number

function assigneeOf(id: number): string | null {
  return (db.prepare('SELECT assignee FROM epic WHERE id = ?').get(id) as { assignee: string | null }).assignee
}

function stateOf(id: number): string {
  return stories.epics.planningOfEpic(id, '2026-09-29').state
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  epicId = stories.createEpic({ projectId, title: 'Mail', businessIntent: 'Mail' }).id
})

describe('taking and releasing a subject with its state in one step', () => {
  it('takes it and starts it together', () => {
    stories.claimEpic(epicId, 'ana', 'doing')

    expect(assigneeOf(epicId)).toBe('ana')
    expect(stateOf(epicId)).toBe('doing')
  })

  it('releases it and puts it back to todo together', () => {
    stories.claimEpic(epicId, 'ana', 'doing')
    stories.releaseEpic(epicId, 'ana', 'todo')

    expect(assigneeOf(epicId)).toBeNull()
    expect(stateOf(epicId)).toBe('todo')
  })

  it('keeps the subject free when its state cannot be set', () => {
    stories.writeStory({ epicId, title: 'One', body: 'body' })

    expect(() => stories.claimEpic(epicId, 'ana', 'doing')).toThrow()
    expect(assigneeOf(epicId)).toBeNull()
  })

  it('keeps the holder when the state cannot be set on release', () => {
    stories.claimEpic(epicId, 'ana')
    stories.writeStory({ epicId, title: 'One', body: 'body' })

    expect(() => stories.releaseEpic(epicId, 'ana', 'todo')).toThrow()
    expect(assigneeOf(epicId)).toBe('ana')
  })

  it('still works without a state', () => {
    stories.claimEpic(epicId, 'ana')
    expect(assigneeOf(epicId)).toBe('ana')
    stories.releaseEpic(epicId, 'ana')
    expect(assigneeOf(epicId)).toBeNull()
  })
})
