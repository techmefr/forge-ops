import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { buildTestBoard } from '../Board/TestBoard.js'

let db: Database.Database
let api: Hono
let projectId: number
let epicId: number
let otherId: number

function call(path: string, method: string, body?: unknown): Promise<Response> {
  return api.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

async function listed(): Promise<Record<string, unknown>[]> {
  return (await (await call(`/api/projects/${projectId}/epics`, 'GET')).json()) as Record<
    string,
    unknown
  >[]
}

beforeEach(() => {
  db = openDatabase(':memory:')
  api = buildTestBoard(db).api
  const repository = createStoryRepository(db)
  projectId = repository.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  }).id
  epicId = repository.createEpic({ projectId, title: 'Cloudmail', businessIntent: 'Mail' }).id
  otherId = repository.createEpic({ projectId, title: 'Billing', businessIntent: 'Bills' }).id
})

describe('PATCH /api/epics/:id', () => {
  it('writes every planning field and hands the epic back', async () => {
    const tag = (await (await call('/api/tags', 'POST', { label: 'Urgent', colour: '#ff0000' })).json()) as {
      id: number
    }
    const response = await call(`/api/epics/${epicId}`, 'PATCH', {
      priority: 'high',
      startedOn: '2026-09-10',
      statusNote: 'Two sentences. Here.',
      requestedBy: 'Anthony',
      tagIds: [tag.id],
      links: [{ kind: 'speckit', url: 'https://example.com/specs' }],
      dependsOn: [otherId],
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: epicId,
      priority: 'high',
      startedOn: '2026-09-10',
      statusNote: 'Two sentences. Here.',
      requestedBy: 'Anthony',
      tags: [{ id: tag.id, label: 'Urgent' }],
      links: [{ kind: 'speckit', url: 'https://example.com/specs' }],
      dependsOn: [otherId],
      waitingOn: [{ id: otherId, title: 'Billing' }],
    })
  })

  it('refuses a priority outside Max, High, Normal, Low', async () => {
    expect((await call(`/api/epics/${epicId}`, 'PATCH', { priority: 'urgent' })).status).toBe(422)
  })

  it('refuses a field it does not know', async () => {
    expect((await call(`/api/epics/${epicId}`, 'PATCH', { colour: 'x' })).status).toBe(422)
  })

  it('refuses a link that is not a web address', async () => {
    const bad = { links: [{ kind: 'doc', url: 'javascript:alert(1)' }] }
    expect((await call(`/api/epics/${epicId}`, 'PATCH', bad)).status).toBe(422)
  })

  it('refuses a link kind it does not know', async () => {
    const bad = { links: [{ kind: 'wiki', url: 'https://example.com' }] }
    expect((await call(`/api/epics/${epicId}`, 'PATCH', bad)).status).toBe(422)
  })

  it('answers 409 to an epic depending on itself', async () => {
    expect((await call(`/api/epics/${epicId}`, 'PATCH', { dependsOn: [epicId] })).status).toBe(409)
  })

  it('answers 409 to a dependency loop', async () => {
    await call(`/api/epics/${epicId}`, 'PATCH', { dependsOn: [otherId] })
    expect((await call(`/api/epics/${otherId}`, 'PATCH', { dependsOn: [epicId] })).status).toBe(409)
  })

  it('answers 404 to an unknown epic and 422 to a bad identifier', async () => {
    expect((await call(`/api/epics/${epicId + 90}`, 'PATCH', { priority: 'low' })).status).toBe(404)
    expect((await call('/api/epics/nope', 'PATCH', { priority: 'low' })).status).toBe(422)
  })

  it('answers 404 to an unknown tag', async () => {
    expect((await call(`/api/epics/${epicId}`, 'PATCH', { tagIds: [44] })).status).toBe(404)
  })
})

describe('GET /api/projects/:id/epics', () => {
  it('carries the derived state, progress, lateness, blockage and waiting', async () => {
    const [first] = await listed()
    expect(first).toMatchObject({
      id: epicId,
      state: 'todo',
      progress: { delivered: 0, total: 0 },
      lateDays: null,
      blockedSince: null,
      waitingOn: [],
      priority: 'normal',
    })
  })

  it('counts late days against the board day', async () => {
    createStoryRepository(db).writeMilestone({ epicId, kind: 'demo', dueOn: '2020-01-01' })
    const [first] = await listed()
    expect(first?.lateDays).toBeGreaterThan(1000)
  })

  it('lists the trash on request', async () => {
    await call(`/api/epics/${epicId}`, 'DELETE')
    const trash = (await (await call(`/api/projects/${projectId}/epics?deleted=true`, 'GET')).json()) as {
      id: number
      state: string
    }[]
    expect(trash).toMatchObject([{ id: epicId, state: 'trash' }])
  })
})

describe('GET /api/epics/:id/history', () => {
  it('lists the states in order with their author', async () => {
    await call(`/api/epics/${epicId}`, 'DELETE')
    await call(`/api/epics/${epicId}/restore`, 'POST')
    const history = (await (await call(`/api/epics/${epicId}/history`, 'GET')).json()) as {
      state: string
      by: string
    }[]
    expect(history.map((change) => [change.state, change.by])).toEqual([
      ['todo', 'system'],
      ['trash', 'local'],
      ['todo', 'local'],
    ])
  })

  it('answers 404 to an unknown epic', async () => {
    expect((await call(`/api/epics/${epicId + 90}/history`, 'GET')).status).toBe(404)
  })
})

describe('DELETE /api/epics/:id and POST /api/epics/:id/restore', () => {
  it('soft deletes then restores', async () => {
    expect((await call(`/api/epics/${epicId}`, 'DELETE')).status).toBe(200)
    expect((await listed()).map((epic) => epic['id'])).toEqual([otherId])
    expect((await call(`/api/epics/${epicId}/restore`, 'POST')).status).toBe(200)
    expect((await listed()).map((epic) => epic['id'])).toEqual([epicId, otherId])
  })

  it('answers 404 when the epic is already deleted', async () => {
    await call(`/api/epics/${epicId}`, 'DELETE')
    expect((await call(`/api/epics/${epicId}`, 'DELETE')).status).toBe(404)
  })

  it('answers 409 when restoring what is not deleted', async () => {
    expect((await call(`/api/epics/${epicId}/restore`, 'POST')).status).toBe(409)
  })
})

describe('/api/tags', () => {
  it('creates, lists, updates and deletes a tag', async () => {
    const created = await call('/api/tags', 'POST', { label: 'Urgent', colour: '#ff0000' })
    expect(created.status).toBe(201)
    const tag = (await created.json()) as { id: number }
    expect(await (await call('/api/tags', 'GET')).json()).toEqual([
      { id: tag.id, label: 'Urgent', colour: '#ff0000', usage: 0 },
    ])
    const renamed = await call(`/api/tags/${tag.id}`, 'PUT', { label: 'Critical', colour: '#00ff00' })
    expect(await renamed.json()).toMatchObject({ label: 'Critical', colour: '#00ff00' })
    expect((await call(`/api/tags/${tag.id}`, 'DELETE')).status).toBe(200)
    expect(await (await call('/api/tags', 'GET')).json()).toEqual([])
  })

  it('answers 409 to a delete while an epic uses the tag', async () => {
    const tag = (await (await call('/api/tags', 'POST', { label: 'Urgent', colour: '#ff0000' })).json()) as {
      id: number
    }
    await call(`/api/epics/${epicId}`, 'PATCH', { tagIds: [tag.id] })
    expect((await call(`/api/tags/${tag.id}`, 'DELETE')).status).toBe(409)
  })

  it('answers 409 to a label already taken', async () => {
    await call('/api/tags', 'POST', { label: 'Urgent', colour: '#ff0000' })
    expect((await call('/api/tags', 'POST', { label: 'Urgent', colour: '#00ff00' })).status).toBe(409)
  })

  it('refuses a colour that is not a hex code', async () => {
    expect((await call('/api/tags', 'POST', { label: 'Urgent', colour: 'red' })).status).toBe(422)
  })

  it('answers 404 to an unknown tag', async () => {
    expect((await call('/api/tags/99', 'DELETE')).status).toBe(404)
    expect((await call('/api/tags/99', 'PUT', { label: 'a', colour: '#000000' })).status).toBe(404)
  })
})

describe('/api/projects/:id/links', () => {
  it('replaces and reads the links of a project', async () => {
    const links = [{ kind: 'repo', url: 'https://example.com/repo' }]
    expect((await call(`/api/projects/${projectId}/links`, 'PUT', { links })).status).toBe(200)
    expect(await (await call(`/api/projects/${projectId}/links`, 'GET')).json()).toEqual(links)
  })

  it('answers 409 to an unknown project like the rest of the board', async () => {
    expect((await call(`/api/projects/${projectId + 9}/links`, 'GET')).status).toBe(409)
  })
})
