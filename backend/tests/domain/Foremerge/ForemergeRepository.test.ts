import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createForemergeRepository,
  type ForemergeRepository,
} from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { ScopeTakenError, ScopeViolationError } from '../../../src/domain/Foremerge/ForemergeViolation.js'

let db: Database.Database
let foremerge: ForemergeRepository
let first: number
let second: number

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails',
  })
  first = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que' }).id
  second = stories.writeStory({ epicId: epic.id, title: 'supprimer les mails', body: 'en tant que' }).id
  foremerge = createForemergeRepository(db, { stories })
})

describe('reserve', () => {
  it('takes a scope nobody holds', () => {
    expect(
      foremerge.reserve({ storyId: first, pathPrefix: 'backend/src/domain/Mail', symbols: [] }),
    ).toMatchObject({ storyId: first, pathPrefix: 'backend/src/domain/Mail' })
  })

  it('stores the path in one single form', () => {
    expect(
      foremerge.reserve({ storyId: first, pathPrefix: '/backend/src/domain/Mail/', symbols: [] })
        .pathPrefix,
    ).toBe('backend/src/domain/Mail')
  })

  it('refuses a blank path, an empty reservation reserves the whole repository', () => {
    expect(() => foremerge.reserve({ storyId: first, pathPrefix: '   ', symbols: [] })).toThrow(
      ScopeViolationError,
    )
  })

  it('refuses a scope another story already holds', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src/domain/Mail', symbols: [] })

    expect(() =>
      foremerge.reserve({ storyId: second, pathPrefix: 'backend/src/domain/Mail', symbols: [] }),
    ).toThrow(ScopeTakenError)
  })

  it('refuses a scope that sits inside one another story holds', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })

    expect(() =>
      foremerge.reserve({ storyId: second, pathPrefix: 'backend/src/domain/Mail', symbols: [] }),
    ).toThrow(ScopeTakenError)
  })

  it('says who holds the scope, so the human knows who to wait for', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })

    expect(() =>
      foremerge.reserve({ storyId: second, pathPrefix: 'backend/src/domain/Mail', symbols: [] }),
    ).toThrow(/FORGE-1/)
  })

  it('refuses a scope colliding on a symbol, even in another folder', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: ['writeStory'] })

    expect(() =>
      foremerge.reserve({ storyId: second, pathPrefix: 'frontend/src', symbols: ['writeStory'] }),
    ).toThrow(ScopeTakenError)
  })

  it('lets the same story widen its own scope', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src/domain/Mail', symbols: [] })

    expect(() =>
      foremerge.reserve({ storyId: first, pathPrefix: 'backend/src/technical/Mail', symbols: [] }),
    ).not.toThrow()
  })

  it('refuses a reservation for a story that does not exist', () => {
    expect(() => foremerge.reserve({ storyId: 999, pathPrefix: 'backend/src', symbols: [] })).toThrow()
  })
})

describe('release', () => {
  it('frees the scope for another story', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    foremerge.release(first)

    expect(() =>
      foremerge.reserve({ storyId: second, pathPrefix: 'backend/src', symbols: [] }),
    ).not.toThrow()
  })

  it('reports how many reservations it freed', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    foremerge.reserve({ storyId: first, pathPrefix: 'frontend/src', symbols: [] })

    expect(foremerge.release(first)).toBe(2)
  })

  it('frees nothing on a story that holds nothing', () => {
    expect(foremerge.release(second)).toBe(0)
  })
})

describe('listReservations', () => {
  it('is empty on a fresh board', () => {
    expect(foremerge.listReservations()).toEqual([])
  })

  it('does not list a released scope', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    foremerge.release(first)

    expect(foremerge.listReservations()).toEqual([])
  })

  it('carries the symbols back out', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: ['writeStory', 'findTwin'] })

    expect(foremerge.listReservations()[0]?.symbols).toEqual(['writeStory', 'findTwin'])
  })
})

describe('collisions', () => {
  it('finds nothing while every scope is distinct', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    foremerge.reserve({ storyId: second, pathPrefix: 'frontend/src', symbols: [] })

    expect(foremerge.collisions()).toEqual([])
  })

  it('reports a collision that slipped in through the file touches', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    db.prepare(
      'INSERT INTO scope_reservation (story_id, path_prefix, symbols) VALUES (?, ?, ?)',
    ).run(second, 'backend/src/domain', '')

    expect(foremerge.collisions()).toHaveLength(1)
  })
})
