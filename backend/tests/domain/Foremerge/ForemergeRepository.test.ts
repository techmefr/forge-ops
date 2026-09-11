import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createForemergeRepository,
  type ForemergeRepository,
} from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { ScopeTakenError, ScopeViolationError } from '../../../src/domain/Foremerge/ForemergeViolation.js'
import { LEASE_MINUTES } from '../../../src/domain/Foremerge/Scope.js'

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

describe('lease', () => {
  function backdate(storyId: number, minutes: number): void {
    db.prepare<[number]>(
      `UPDATE scope_reservation
       SET reserved_at = datetime('now', '-${minutes} minutes'),
           renewed_at = datetime('now', '-${minutes} minutes')
       WHERE story_id = ?`,
    ).run(storyId)
  }

  it('hands a prefix back once the lease of its holder has lapsed', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    backdate(first, LEASE_MINUTES + 1)

    expect(() =>
      foremerge.reserve({ storyId: second, pathPrefix: 'backend/src', symbols: [] }),
    ).not.toThrow()
  })

  it('keeps refusing a prefix whose lease is still running', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    backdate(first, LEASE_MINUTES - 1)

    expect(() =>
      foremerge.reserve({ storyId: second, pathPrefix: 'backend/src', symbols: [] }),
    ).toThrow(ScopeTakenError)
  })

  it('stops listing a reservation whose lease has lapsed', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    backdate(first, LEASE_MINUTES + 1)

    expect(foremerge.listReservations()).toEqual([])
  })

  it('marks a lapsed reservation released, so the takeback leaves a trace', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    backdate(first, LEASE_MINUTES + 1)
    foremerge.listReservations()

    expect(
      db
        .prepare<[number], { released_at: string | null }>(
          'SELECT released_at FROM scope_reservation WHERE story_id = ?',
        )
        .get(first)?.released_at,
    ).not.toBeNull()
  })

  function stamps(storyId: number): { reserved_at: string; renewed_at: string | null } {
    return (
      db
        .prepare<[number], { reserved_at: string; renewed_at: string | null }>(
          'SELECT reserved_at, renewed_at FROM scope_reservation WHERE story_id = ?',
        )
        .get(storyId) ?? { reserved_at: '', renewed_at: null }
    )
  }

  it('renews the lease of a story that is still working', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    backdate(first, LEASE_MINUTES - 1)

    expect(foremerge.renew(first)).toBe(1)

    const held = stamps(first)
    expect((held.renewed_at ?? '') > held.reserved_at).toBe(true)
  })

  it('refuses to resurrect a claim whose lease has already lapsed', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    backdate(first, LEASE_MINUTES + 1)

    expect(foremerge.renew(first)).toBe(0)
  })

  it('renews the lease when the story claims a prefix it already holds', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    backdate(first, LEASE_MINUTES - 1)
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })

    const held = stamps(first)
    expect((held.renewed_at ?? '') > held.reserved_at).toBe(true)
  })

  it('says since when the prefix is held, so a human knows whether to wait', () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    const since = foremerge.listReservations()[0]?.reservedAt ?? ''

    expect(() =>
      foremerge.reserve({ storyId: second, pathPrefix: 'backend/src', symbols: [] }),
    ).toThrow(`depuis ${since}`)
  })
})
