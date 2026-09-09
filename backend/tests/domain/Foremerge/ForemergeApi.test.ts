import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { createForemergeApi } from '../../../src/domain/Foremerge/ForemergeApi.js'
import { createEventBus, type BoardEvent } from '../../../src/technical/Http/EventBus.js'

let db: Database.Database
let stories: StoryRepository
let api: Hono
let seen: BoardEvent[]
let first: number
let second: number

function send(path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<Response> {
  return api.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  seen = []
  const events = createEventBus()
  events.subscribe((event) => seen.push(event))
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
  first = stories.writeStory({ epicId: epic.id, title: 'visualiser', body: 'en tant que' }).id
  second = stories.writeStory({ epicId: epic.id, title: 'supprimer', body: 'en tant que' }).id
  api = createForemergeApi({ foremerge: createForemergeRepository(db, { stories }), events })
})

describe('POST /api/stories/:id/scope', () => {
  it('reserves a scope', async () => {
    const response = await send(`/api/stories/${first}/scope`, 'POST', {
      pathPrefix: 'backend/src/domain/Mail',
      symbols: ['writeMail'],
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ pathPrefix: 'backend/src/domain/Mail' })
  })

  it('announces the reservation, so every open board sees it', async () => {
    await send(`/api/stories/${first}/scope`, 'POST', { pathPrefix: 'backend/src', symbols: [] })

    expect(seen.map((event) => event.name)).toContain('scope.reserved')
  })

  it('refuses a scope another story holds, with the holder named', async () => {
    await send(`/api/stories/${first}/scope`, 'POST', { pathPrefix: 'backend/src', symbols: [] })

    const response = await send(`/api/stories/${second}/scope`, 'POST', {
      pathPrefix: 'backend/src/domain',
      symbols: [],
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'ScopeTakenError', heldBy: 'FORGE-1' })
  })

  it('refuses a blank claim without leaking a database error', async () => {
    const response = await send(`/api/stories/${first}/scope`, 'POST', { pathPrefix: '', symbols: [] })

    expect(response.status).toBe(422)
  })

  it('refuses a claim on a story that does not exist', async () => {
    const response = await send('/api/stories/999/scope', 'POST', {
      pathPrefix: 'backend/src',
      symbols: [],
    })

    expect(response.status).toBe(404)
  })
})

describe('DELETE /api/stories/:id/scope', () => {
  it('releases what a story holds and says how much', async () => {
    await send(`/api/stories/${first}/scope`, 'POST', { pathPrefix: 'backend/src', symbols: [] })

    const response = await send(`/api/stories/${first}/scope`, 'DELETE')

    await expect(response.json()).resolves.toEqual({ released: 1 })
  })
})

describe('GET /api/scope', () => {
  it('lists what is reserved', async () => {
    await send(`/api/stories/${first}/scope`, 'POST', { pathPrefix: 'backend/src', symbols: [] })

    await expect((await api.request('/api/scope/reservations')).json()).resolves.toMatchObject([
      { storyReference: 'FORGE-1' },
    ])
  })

  it('reports the collisions the board is living with', async () => {
    await send(`/api/stories/${first}/scope`, 'POST', { pathPrefix: 'backend/src', symbols: [] })
    db.prepare('INSERT INTO scope_reservation (story_id, path_prefix, symbols) VALUES (?, ?, ?)').run(
      second,
      'backend/src/domain',
      '',
    )

    await expect((await api.request('/api/scope/collisions')).json()).resolves.toHaveLength(1)
  })
})
