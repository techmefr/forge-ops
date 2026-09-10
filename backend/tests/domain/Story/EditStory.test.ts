import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createStoryRepository,
  type StoryRepository,
} from '../../../src/domain/Story/StoryRepository.js'

let db: Database.Database
let repository: StoryRepository
let storyId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  repository = createStoryRepository(db)
  const project = repository.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = repository.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'Gerer les mails',
  })
  storyId = repository.writeStory({ epicId: epic.id, title: 'un titre', body: 'un corps' }).id
})

describe('editStory', () => {
  it('rewrites the title', () => {
    expect(repository.editStory(storyId, { title: 'un autre titre', body: 'un corps' }).title).toBe(
      'un autre titre',
    )
  })

  it('rewrites the body', () => {
    expect(repository.editStory(storyId, { title: 'un titre', body: 'un autre corps' }).body).toBe(
      'un autre corps',
    )
  })

  it('keeps the reference, the card does not change identity', () => {
    const before = repository.findStory(storyId).reference
    expect(repository.editStory(storyId, { title: 'x', body: 'y' }).reference).toBe(before)
  })

  it('keeps the state, editing is not advancing', () => {
    repository.writeTwin({ storyId, title: 'un titre de test', body: 'des cas' })
    repository.sendToBacklog(storyId)
    expect(repository.editStory(storyId, { title: 'x', body: 'y' }).state).toBe('backlog')
  })

  it('refuses an empty title, a card without a name is not a card', () => {
    expect(() => repository.editStory(storyId, { title: '  ', body: 'un corps' })).toThrow()
  })

  it('refuses an empty body', () => {
    expect(() => repository.editStory(storyId, { title: 'un titre', body: '  ' })).toThrow()
  })

  it('refuses an unknown story', () => {
    expect(() => repository.editStory(storyId + 500, { title: 'x', body: 'y' })).toThrow()
  })

  it('persists what it rewrote', () => {
    repository.editStory(storyId, { title: 'garde moi', body: 'un corps' })
    expect(repository.findStory(storyId).title).toBe('garde moi')
  })
})
