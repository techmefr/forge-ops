import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { buildTestBoard } from '../Board/TestBoard.js'

let db: Database.Database
let api: Hono
let projectId: number
let otherProjectId: number
let epicId: number
let foreignEpicId: number

function call(path: string, method: string, body?: unknown): Promise<Response> {
  return api.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

async function created(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await call('/api/events', 'POST', { projectId, ...body })
  expect(response.status).toBe(201)
  return (await response.json()) as Record<string, unknown>
}

async function listed(query = ''): Promise<Record<string, unknown>[]> {
  const response = await call(`/api/projects/${projectId}/events${query}`, 'GET')
  expect(response.status).toBe(200)
  return (await response.json()) as Record<string, unknown>[]
}

beforeEach(() => {
  db = openDatabase(':memory:')
  api = buildTestBoard(db).api
  const repository = createStoryRepository(db)
  const draft = { repositoryUrl: 'git@example.com:x.git', integrationBranch: 'main', colour: '#ff3b00' }
  projectId = repository.createProject({ slug: 'forge', name: 'Forge', ...draft }).id
  otherProjectId = repository.createProject({ slug: 'skera', name: 'Skera', ...draft }).id
  epicId = repository.createEpic({ projectId, title: 'Cloudmail', businessIntent: 'Mail' }).id
  foreignEpicId = repository.createEpic({ projectId: otherProjectId, title: 'Billing', businessIntent: 'Bills' }).id
})

describe('POST /api/events', () => {
  it('writes a project-level event with no epic', async () => {
    const event = await created({ type: 'steering', date: '2026-10-09', title: 'Steering committee' })
    expect(event).toMatchObject({
      type: 'steering',
      date: '2026-10-09',
      title: 'Steering committee',
      projectId,
      epicId: null,
      note: null,
      minutes: null,
      minutesUpdatedAt: null,
    })
    expect(typeof event.id).toBe('number')
  })

  it('links an event to an epic of the same project', async () => {
    const event = await created({ type: 'demo', date: '2026-09-30', epicId, note: 'With the client' })
    expect(event).toMatchObject({ epicId, note: 'With the client' })
  })

  it('accepts several events of the same type on one epic', async () => {
    await created({ type: 'client', date: '2026-10-01', epicId })
    await created({ type: 'client', date: '2026-10-15', epicId })
    expect(await listed()).toHaveLength(2)
  })

  it('refuses an epic that belongs to another project', async () => {
    const response = await call('/api/events', 'POST', {
      projectId,
      type: 'demo',
      date: '2026-09-30',
      epicId: foreignEpicId,
    })
    expect(response.status).toBe(409)
  })

  it('refuses an unknown project', async () => {
    const response = await call('/api/events', 'POST', { projectId: 999, type: 'demo', date: '2026-09-30' })
    expect(response.status).toBe(409)
  })

  it('refuses an unknown type, a malformed date and stray fields', async () => {
    for (const body of [
      { projectId, type: 'party', date: '2026-09-30' },
      { projectId, type: 'demo', date: '30/09/2026' },
      { projectId, type: 'demo', date: '2026-09-30', colour: 'red' },
      { type: 'demo', date: '2026-09-30' },
    ]) {
      expect((await call('/api/events', 'POST', body)).status).toBe(422)
    }
  })

  it('stamps the minutes date when minutes are given at creation', async () => {
    const event = await created({ type: 'other', date: '2026-09-01', minutes: 'Decided X' })
    expect(event.minutes).toBe('Decided X')
    expect(typeof event.minutesUpdatedAt).toBe('string')
  })
})

describe('GET /api/projects/:id/events', () => {
  it('lists the events of the project by date, project-level ones included', async () => {
    await created({ type: 'production', date: '2026-10-06', epicId })
    await created({ type: 'steering', date: '2026-09-11' })
    await call('/api/events', 'POST', { projectId: otherProjectId, type: 'demo', date: '2026-09-01' })
    expect((await listed()).map((event) => event.date)).toEqual(['2026-09-11', '2026-10-06'])
  })

  it('keeps only the events inside from and to, both included', async () => {
    await created({ type: 'demo', date: '2026-09-01' })
    await created({ type: 'demo', date: '2026-09-15' })
    await created({ type: 'demo', date: '2026-10-01' })
    expect((await listed('?from=2026-09-15&to=2026-10-01')).map((event) => event.date)).toEqual([
      '2026-09-15',
      '2026-10-01',
    ])
    expect((await listed('?from=2026-09-16')).map((event) => event.date)).toEqual(['2026-10-01'])
    expect((await listed('?to=2026-09-01')).map((event) => event.date)).toEqual(['2026-09-01'])
  })

  it('refuses a malformed window and a malformed project identifier', async () => {
    expect((await call(`/api/projects/${projectId}/events?from=yesterday`, 'GET')).status).toBe(422)
    expect((await call('/api/projects/abc/events', 'GET')).status).toBe(422)
  })

  it('answers 409 to an unknown project like the rest of the board', async () => {
    expect((await call('/api/projects/999/events', 'GET')).status).toBe(409)
  })
})

describe('PATCH /api/events/:id', () => {
  it('rewrites the fields it is given and keeps the others', async () => {
    const event = await created({ type: 'demo', date: '2026-09-30', title: 'Demo', epicId })
    const response = await call(`/api/events/${event.id}`, 'PATCH', { date: '2026-10-02', note: 'Moved' })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: event.id,
      type: 'demo',
      date: '2026-10-02',
      title: 'Demo',
      epicId,
      note: 'Moved',
    })
  })

  it('writes the minutes and stamps when they were written', async () => {
    const event = await created({ type: 'client', date: '2026-09-01' })
    const response = await call(`/api/events/${event.id}`, 'PATCH', { minutes: 'Agreed on scope' })
    const body = (await response.json()) as Record<string, unknown>
    expect(body.minutes).toBe('Agreed on scope')
    expect(typeof body.minutesUpdatedAt).toBe('string')
  })

  it('does not restamp the minutes when they are unchanged', async () => {
    const event = await created({ type: 'client', date: '2026-09-01', minutes: 'Same' })
    db.prepare("UPDATE epic_milestone SET minutes_updated_at = '2026-09-02T10:00:00.000Z'").run()
    const body = (await (
      await call(`/api/events/${event.id}`, 'PATCH', { minutes: 'Same', note: 'x' })
    ).json()) as Record<string, unknown>
    expect(body.minutesUpdatedAt).toBe('2026-09-02T10:00:00.000Z')
  })

  it('empties the minutes when they are cleared or blank', async () => {
    const event = await created({ type: 'client', date: '2026-09-01', minutes: 'Something' })
    const body = (await (await call(`/api/events/${event.id}`, 'PATCH', { minutes: '   ' })).json()) as Record<
      string,
      unknown
    >
    expect(body.minutes).toBeNull()
    expect(body.minutesUpdatedAt).toBeNull()
  })

  it('detaches the epic with null and refuses an epic of another project', async () => {
    const event = await created({ type: 'demo', date: '2026-09-30', epicId })
    const detached = (await (await call(`/api/events/${event.id}`, 'PATCH', { epicId: null })).json()) as Record<
      string,
      unknown
    >
    expect(detached.epicId).toBeNull()
    expect((await call(`/api/events/${event.id}`, 'PATCH', { epicId: foreignEpicId })).status).toBe(409)
  })

  it('refuses stray fields such as the project, and unknown events', async () => {
    const event = await created({ type: 'demo', date: '2026-09-30' })
    expect((await call(`/api/events/${event.id}`, 'PATCH', { projectId: otherProjectId })).status).toBe(422)
    expect((await call('/api/events/999', 'PATCH', { note: 'x' })).status).toBe(404)
    expect((await call('/api/events/abc', 'PATCH', { note: 'x' })).status).toBe(422)
  })
})

describe('DELETE /api/events/:id', () => {
  it('removes the event', async () => {
    const event = await created({ type: 'demo', date: '2026-09-30' })
    expect((await call(`/api/events/${event.id}`, 'DELETE')).status).toBe(200)
    expect(await listed()).toEqual([])
    expect((await call(`/api/events/${event.id}`, 'DELETE')).status).toBe(404)
  })
})

describe('events and the deadlines of an epic', () => {
  it('lets only demo, production and everyone events drive the lateness of an epic', async () => {
    const repository = createStoryRepository(db)
    await created({ type: 'client', date: '2020-01-01', epicId })
    await created({ type: 'steering', date: '2020-01-01', epicId })
    const quiet = repository.listEpics(projectId, { today: '2026-09-29' })
    expect(quiet.find((epic) => epic.id === epicId)?.lateDays).toBeNull()
    await created({ type: 'demo', date: '2026-09-20', epicId })
    const late = repository.listEpics(projectId, { today: '2026-09-29' })
    expect(late.find((epic) => epic.id === epicId)?.lateDays).toBe(9)
  })
})
