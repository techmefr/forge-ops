import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  BlockedByDependencyError,
  SelfDependencyError,
  StoryNotFoundError,
  TwinAlreadyWrittenError,
  TwinOfTwinError,
  TwinRequiredError,
} from '../../../src/domain/Story/StoryViolation.js'

let db: Database.Database
let repository: StoryRepository
let epicId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  repository = createStoryRepository(db)
  const project = repository.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  epicId = repository.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails du client',
  }).id
})

describe('writeStory', () => {
  it('opens a functional story in drafting, without twin', () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })

    expect(story.kind).toBe('functional')
    expect(story.state).toBe('drafting')
    expect(story.twinOfStoryId).toBeNull()
  })

  it('derives the reference from the project slug and increments it', () => {
    const first = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    const second = repository.writeStory({ epicId, title: 'creer un mail', body: 'en tant que...' })

    expect(first.reference).toBe('FORGE-1')
    expect(second.reference).toBe('FORGE-2')
  })
})

describe('writeTwin', () => {
  it('links a test story to its functional story', () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    const twin = repository.writeTwin({ storyId: story.id, title: 'tests visualiser les mails', body: 'cas...' })

    expect(twin.kind).toBe('test')
    expect(twin.twinOfStoryId).toBe(story.id)
    expect(twin.reference).toBe('FORGE-1-T')
  })

  it('refuses a second twin for the same story', () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    repository.writeTwin({ storyId: story.id, title: 'tests visualiser les mails', body: 'cas...' })

    expect(() => repository.writeTwin({ storyId: story.id, title: 'autres tests', body: 'cas...' })).toThrow(
      TwinAlreadyWrittenError,
    )
  })

  it('refuses to twin a test story', () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    const twin = repository.writeTwin({ storyId: story.id, title: 'tests visualiser les mails', body: 'cas...' })

    expect(() => repository.writeTwin({ storyId: twin.id, title: 'tests des tests', body: 'cas...' })).toThrow(
      TwinOfTwinError,
    )
  })

  it('refuses an unknown story', () => {
    expect(() => repository.writeTwin({ storyId: 404, title: 'tests', body: 'cas...' })).toThrow(StoryNotFoundError)
  })
})

describe('sendToBacklog', () => {
  it('refuses a functional story that has no twin', () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })

    expect(() => repository.sendToBacklog(story.id)).toThrow(TwinRequiredError)
  })

  it('moves the story and its twin together', () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    const twin = repository.writeTwin({ storyId: story.id, title: 'tests visualiser les mails', body: 'cas...' })

    repository.sendToBacklog(story.id)

    expect(repository.findStory(story.id).state).toBe('backlog')
    expect(repository.findStory(twin.id).state).toBe('backlog')
  })
})

describe('addDependency', () => {
  it('refuses a story that depends on itself', () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })

    expect(() => repository.addDependency({ blockedStoryId: story.id, blockingStoryId: story.id })).toThrow(
      SelfDependencyError,
    )
  })
})

describe('startBuilding', () => {
  function backloggedStory(title: string): number {
    const story = repository.writeStory({ epicId, title, body: 'en tant que...' })
    repository.writeTwin({ storyId: story.id, title: `tests ${title}`, body: 'cas...' })
    repository.sendToBacklog(story.id)
    return story.id
  }

  it('refuses while a blocking story is not done', () => {
    const blocking = backloggedStory('creer un mail')
    const blocked = backloggedStory('visualiser les mails')
    repository.addDependency({ blockedStoryId: blocked, blockingStoryId: blocking })

    expect(() => repository.startBuilding(blocked)).toThrow(BlockedByDependencyError)
  })

  it('allows it once every blocking story is done', () => {
    const blocking = backloggedStory('creer un mail')
    const blocked = backloggedStory('visualiser les mails')
    repository.addDependency({ blockedStoryId: blocked, blockingStoryId: blocking })
    repository.markDone(blocking)

    expect(repository.startBuilding(blocked).state).toBe('building')
  })

  it('allows a story with no dependency', () => {
    const story = backloggedStory('visualiser les mails')

    expect(repository.startBuilding(story).state).toBe('building')
  })
})

describe('listBacklog', () => {
  it('returns the functional stories waiting in the backlog, newest reference last', () => {
    const first = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    repository.writeTwin({ storyId: first.id, title: 'tests visualiser', body: 'cas...' })
    repository.sendToBacklog(first.id)
    const second = repository.writeStory({ epicId, title: 'creer un mail', body: 'en tant que...' })
    repository.writeTwin({ storyId: second.id, title: 'tests creer', body: 'cas...' })
    repository.sendToBacklog(second.id)
    repository.startBuilding(second.id)

    const backlog = repository.listBacklog()

    expect(backlog.map((story) => story.reference)).toEqual(['FORGE-1'])
  })
})
