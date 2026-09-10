import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { buildTestBoard } from '../Board/TestBoard.js'

let db: Database.Database
let api: Hono
let storyId: number

function put(id: number, body: unknown): Promise<Response> {
  return api.request(`/api/stories/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  db = openDatabase(':memory:')
  api = buildTestBoard(db).api
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
    businessIntent: 'Gerer les mails',
  })
  storyId = stories.writeStory({ epicId: epic.id, title: 'un titre', body: 'un corps' }).id
})

describe('PUT /api/stories/:id', () => {
  it('rewrites the card', async () => {
    const response = await put(storyId, { title: 'un autre titre', body: 'un autre corps' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ title: 'un autre titre' })
  })

  it('keeps the reference', async () => {
    const response = await put(storyId, { title: 'x titre', body: 'y corps' })

    await expect(response.json()).resolves.toMatchObject({ reference: 'FORGE-1' })
  })

  it('refuses an empty title', async () => {
    expect((await put(storyId, { title: '   ', body: 'un corps' })).status).toBe(422)
  })

  it('refuses a body that is not there', async () => {
    expect((await put(storyId, { title: 'un titre' })).status).toBe(422)
  })

  it('refuses an unknown story', async () => {
    expect((await put(storyId + 500, { title: 'x', body: 'y' })).status).toBe(404)
  })

  it('refuses an identifier that is not one', async () => {
    const response = await api.request('/api/stories/nope', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'x', body: 'y' }),
    })

    expect(response.status).toBe(422)
  })
})
