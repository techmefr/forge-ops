import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { buildTestBoard } from './TestBoard.js'

let db: Database.Database
let api: Hono
let projectId: number

function call(path: string, method: string, body?: unknown): Promise<Response> {
  return api.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  db = openDatabase(':memory:')
  api = buildTestBoard(db).api
  projectId = createStoryRepository(db).createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
})

describe('POST /api/projects from the small form', () => {
  it('creates a project from a name, a colour and a repository', async () => {
    const response = await call('/api/projects', 'POST', {
      name: 'Cloud Mail',
      colour: '#0f9d8a',
      repository: 'git@example.com:mail.git',
    })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      slug: 'cloud-mail',
      name: 'Cloud Mail',
      colour: '#0f9d8a',
      repositoryUrl: 'git@example.com:mail.git',
      integrationBranch: 'main',
    })
  })

  it('accepts a project without a repository', async () => {
    const response = await call('/api/projects', 'POST', { name: 'Ideas', colour: '#0f9d8a' })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ slug: 'ideas', repositoryUrl: '' })
  })

  it('finds a free slug when the name only differs by accents or spacing', async () => {
    await call('/api/projects', 'POST', { name: 'Éclair', colour: '#0f9d8a' })
    const response = await call('/api/projects', 'POST', { name: 'Eclair!', colour: '#0f9d8a' })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ slug: 'eclair-2' })
  })

  it('refuses a name already taken whatever its case', async () => {
    const response = await call('/api/projects', 'POST', { name: 'FORGE', colour: '#0f9d8a' })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'ProjectSlugTakenError' })
  })

  it('refuses a blank name', async () => {
    const response = await call('/api/projects', 'POST', { name: '   ', colour: '#0f9d8a' })
    expect(response.status).toBe(422)
  })

  it('still accepts the full legacy draft', async () => {
    const response = await call('/api/projects', 'POST', {
      slug: 'legacy',
      name: 'Legacy',
      repositoryUrl: 'git@example.com:legacy.git',
      integrationBranch: 'develop',
      colour: 'acc',
    })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ slug: 'legacy', integrationBranch: 'develop' })
  })
})

describe('POST /api/epics from the subject form', () => {
  it('creates a subject with a title only', async () => {
    const response = await call('/api/epics', 'POST', { projectId, title: 'Migration SMTP' })
    expect(response.status).toBe(201)
    const created = (await response.json()) as { id: number }
    const listed = (await (await call('/api/epics', 'GET')).json()) as Record<string, unknown>[]
    expect(listed.find((epic) => epic.id === created.id)).toMatchObject({
      title: 'Migration SMTP',
      assignee: null,
      state: 'todo',
      priority: 'normal',
    })
  })

  it('writes owner, planning fields, tags, links and dependencies in one call', async () => {
    const other = (await (await call('/api/epics', 'POST', { projectId, title: 'Billing' })).json()) as {
      id: number
    }
    const tag = (await (await call('/api/tags', 'POST', { label: 'Urgent', colour: '#ff0000' })).json()) as {
      id: number
    }
    const response = await call('/api/epics', 'POST', {
      projectId,
      title: 'Cloudmail',
      assignee: 'anna',
      priority: 'high',
      startedOn: '2026-09-10',
      statusNote: 'Two sentences. Here.',
      requestedBy: 'Anthony',
      tagIds: [tag.id],
      links: [{ kind: 'speckit', url: 'https://example.com/specs' }],
      dependsOn: [other.id],
    })
    expect(response.status).toBe(201)
    const created = (await response.json()) as { id: number }
    const listed = (await (await call('/api/epics', 'GET')).json()) as Record<string, unknown>[]
    expect(listed.find((epic) => epic.id === created.id)).toMatchObject({
      assignee: 'anna',
      priority: 'high',
      startedOn: '2026-09-10',
      statusNote: 'Two sentences. Here.',
      requestedBy: 'Anthony',
      tags: [{ id: tag.id, label: 'Urgent' }],
      links: [{ kind: 'speckit', url: 'https://example.com/specs' }],
      dependsOn: [other.id],
      state: 'doing',
    })
  })

  it('refuses a blank title and an unknown field', async () => {
    expect((await call('/api/epics', 'POST', { projectId, title: '  ' })).status).toBe(422)
    expect((await call('/api/epics', 'POST', { projectId, title: 'x', colour: 'red' })).status).toBe(422)
  })

  it('refuses an unknown project', async () => {
    expect((await call('/api/epics', 'POST', { projectId: 999, title: 'x' })).status).toBe(409)
  })

  it('leaves no subject behind when a planning field is refused', async () => {
    const response = await call('/api/epics', 'POST', { projectId, title: 'Loner', dependsOn: [999] })
    expect(response.status).toBeGreaterThanOrEqual(400)
    const listed = (await (await call('/api/epics', 'GET')).json()) as { title: string }[]
    expect(listed.some((epic) => epic.title === 'Loner')).toBe(false)
  })
})

describe('PUT /api/epics/:id/assignee', () => {
  it('hands the subject to somebody else then to nobody', async () => {
    const created = (await (
      await call('/api/epics', 'POST', { projectId, title: 'Cloudmail', assignee: 'anna' })
    ).json()) as { id: number }
    expect((await call(`/api/epics/${created.id}/assignee`, 'PUT', { login: 'bob' })).status).toBe(200)
    let listed = (await (await call('/api/epics', 'GET')).json()) as { id: number; assignee: string | null }[]
    expect(listed.find((epic) => epic.id === created.id)?.assignee).toBe('bob')
    expect((await call(`/api/epics/${created.id}/assignee`, 'PUT', { login: null })).status).toBe(200)
    listed = (await (await call('/api/epics', 'GET')).json()) as { id: number; assignee: string | null }[]
    expect(listed.find((epic) => epic.id === created.id)?.assignee).toBeNull()
  })

  it('refuses an unknown subject', async () => {
    expect((await call('/api/epics/999/assignee', 'PUT', { login: 'bob' })).status).toBe(404)
  })
})

describe('PATCH /api/epics/:id title', () => {
  it('renames a subject and refuses a blank title', async () => {
    const created = (await (await call('/api/epics', 'POST', { projectId, title: 'Old' })).json()) as { id: number }
    expect((await call(`/api/epics/${created.id}`, 'PATCH', { title: '  New name ' })).status).toBe(200)
    const listed = (await (await call('/api/epics', 'GET')).json()) as { id: number; title: string }[]
    expect(listed.find((epic) => epic.id === created.id)?.title).toBe('New name')
    expect((await call(`/api/epics/${created.id}`, 'PATCH', { title: '   ' })).status).toBe(422)
  })
})
