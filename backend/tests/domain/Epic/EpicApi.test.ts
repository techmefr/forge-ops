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
  const repository = createStoryRepository(db)
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

describe('GET /api/board/self', () => {
  it('names the operator the board acts for', async () => {
    const response = await call('/api/board/self', 'GET')
    expect(await response.json()).toMatchObject({ login: 'local' })
  })
})

describe('GET /api/projects/:id/epics', () => {
  it('hands out the epic with nobody on it', async () => {
    const response = await call(`/api/projects/${projectId}/epics`, 'GET')
    expect(await response.json()).toMatchObject([{ id: epicId, assignee: null }])
  })
})

describe('POST /api/epics/:id/claim', () => {
  it('puts the epic under the operator', async () => {
    expect((await call(`/api/epics/${epicId}/claim`, 'POST')).status).toBe(200)
    const listed = (await (await call(`/api/projects/${projectId}/epics`, 'GET')).json()) as {
      assignee: string | null
    }[]
    expect(listed[0]?.assignee).toBe('local')
  })

  it('refuses an epic held by someone else', async () => {
    createStoryRepository(db).claimEpic(epicId, 'quelqu un')
    expect((await call(`/api/epics/${epicId}/claim`, 'POST')).status).toBe(409)
  })

  it('refuses an unknown epic', async () => {
    expect((await call(`/api/epics/${epicId + 500}/claim`, 'POST')).status).toBe(404)
  })

  it('refuses an identifier that is not one', async () => {
    expect((await call('/api/epics/nope/claim', 'POST')).status).toBe(422)
  })
})

describe('DELETE /api/epics/:id/claim', () => {
  it('gives the epic back to nobody', async () => {
    await call(`/api/epics/${epicId}/claim`, 'POST')
    expect((await call(`/api/epics/${epicId}/claim`, 'DELETE')).status).toBe(200)
    const listed = (await (await call(`/api/projects/${projectId}/epics`, 'GET')).json()) as {
      assignee: string | null
    }[]
    expect(listed[0]?.assignee).toBeNull()
  })

  it('refuses to release what someone else holds', async () => {
    createStoryRepository(db).claimEpic(epicId, 'quelqu un')
    expect((await call(`/api/epics/${epicId}/claim`, 'DELETE')).status).toBe(409)
  })
})
