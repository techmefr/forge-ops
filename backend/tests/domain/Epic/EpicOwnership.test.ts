import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createStoryRepository,
  type StoryRepository,
} from '../../../src/domain/Story/StoryRepository.js'

let db: Database.Database
let repository: StoryRepository
let projectId: number
let epicId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  repository = createStoryRepository(db)
  projectId = repository.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  }).id
  epicId = repository.createEpic({
    projectId,
    title: 'CRUD Mail',
    businessIntent: 'Gerer les mails',
  }).id
})

describe('a fresh epic', () => {
  it('belongs to nobody', () => {
    expect(repository.listEpics(projectId)[0]?.assignee).toBeNull()
  })
})

describe('claimEpic', () => {
  it('puts the epic under a name', () => {
    repository.claimEpic(epicId, 'gaetan')
    expect(repository.listEpics(projectId)[0]?.assignee).toBe('gaetan')
  })

  it('lets the same person claim it again', () => {
    repository.claimEpic(epicId, 'gaetan')
    expect(() => repository.claimEpic(epicId, 'gaetan')).not.toThrow()
  })

  it('refuses an epic already taken by someone else', () => {
    repository.claimEpic(epicId, 'gaetan')
    expect(() => repository.claimEpic(epicId, 'autre')).toThrow(/gaetan/)
  })

  it('refuses an unknown epic', () => {
    expect(() => repository.claimEpic(epicId + 500, 'gaetan')).toThrow()
  })
})

describe('releaseEpic', () => {
  it('gives the epic back to nobody', () => {
    repository.claimEpic(epicId, 'gaetan')
    repository.releaseEpic(epicId, 'gaetan')
    expect(repository.listEpics(projectId)[0]?.assignee).toBeNull()
  })

  it('refuses to release what belongs to someone else', () => {
    repository.claimEpic(epicId, 'gaetan')
    expect(() => repository.releaseEpic(epicId, 'autre')).toThrow(/gaetan/)
  })

  it('says nothing when the epic was already free', () => {
    expect(() => repository.releaseEpic(epicId, 'gaetan')).not.toThrow()
  })
})

describe('the epic list', () => {
  it('still counts the stories written from the epic', () => {
    repository.writeStory({ epicId, title: 'voir les mails', body: 'un corps' })
    expect(repository.listEpics(projectId)[0]?.storyCount).toBe(1)
  })

  it('keeps the assignee alongside the count', () => {
    repository.claimEpic(epicId, 'gaetan')
    repository.writeStory({ epicId, title: 'voir les mails', body: 'un corps' })
    expect(repository.listEpics(projectId)[0]).toMatchObject({
      assignee: 'gaetan',
      storyCount: 1,
    })
  })
})
