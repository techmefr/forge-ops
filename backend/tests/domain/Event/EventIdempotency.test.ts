import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createEventRepository, type EventRepository } from '../../../src/domain/Event/EventRepository.js'
import type { EventDraft } from '../../../../contract/EventContract.js'

let db: Database.Database
let agenda: EventRepository
let projectId: number
let epicId: number

function draft(overrides: Partial<EventDraft> = {}): EventDraft {
  return {
    type: 'production',
    date: '2026-10-15',
    title: 'Release',
    projectId,
    epicId,
    note: null,
    minutes: null,
    ...overrides,
  }
}

function count(): number {
  return (db.prepare('SELECT COUNT(*) AS total FROM epic_milestone').get() as { total: number }).total
}

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  projectId = stories.createProject({
    slug: 'alpha',
    name: 'Alpha',
    repositoryUrl: 'git@example.com:alpha.git',
    integrationBranch: 'main',
    colour: '#112233',
  }).id
  epicId = stories.createEpic({ projectId, title: 'Sujet', businessIntent: 'x' }).id
  agenda = createEventRepository(db)
})

describe('creating the same milestone twice', () => {
  it('hands back the event that exists instead of adding a second one', () => {
    const first = agenda.create(draft())

    const retried = agenda.create(draft())

    expect(retried.id).toBe(first.id)
    expect(count()).toBe(1)
  })

  it('still adds a milestone on another date or of another type', () => {
    agenda.create(draft())
    agenda.create(draft({ date: '2026-10-16' }))
    agenda.create(draft({ type: 'demo' }))

    expect(count()).toBe(3)
  })

  it('leaves project events without a subject alone', () => {
    agenda.create(draft({ epicId: null }))
    agenda.create(draft({ epicId: null }))

    expect(count()).toBe(2)
  })
})
