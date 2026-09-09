import { beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'

let api: Hono
let repository: StoryRepository
let epicId: number
let claudeHome: string

async function post(path: string, body?: unknown): Promise<Response> {
  return await api.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  repository = createStoryRepository(openDatabase(':memory:'))
  const project = repository.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/starfleet.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  epicId = repository.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails du client',
  }).id
  claudeHome = mkdtempSync(join(tmpdir(), 'starfleet-claude-home-'))
  api = createBoardApi({ repository, claudeHome })
})

describe('POST /api/stories', () => {
  it('writes a story and answers with its reference', async () => {
    const response = await post('/api/stories', { epicId, title: 'visualiser les mails', body: 'en tant que...' })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ reference: 'FORGE-1', state: 'drafting' })
  })

  it('refuses a body that does not match the contract', async () => {
    const response = await post('/api/stories', { epicId, title: 'visualiser les mails' })

    expect(response.status).toBe(422)
  })
})

describe('POST /api/stories/:id/twin', () => {
  it('writes the twin test story', async () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })

    const response = await post(`/api/stories/${story.id}/twin`, { title: 'tests visualiser', body: 'cas...' })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ reference: 'FORGE-1-T', kind: 'test' })
  })

  it('reports a domain refusal as a conflict, not a server error', async () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    repository.writeTwin({ storyId: story.id, title: 'tests visualiser', body: 'cas...' })

    const response = await post(`/api/stories/${story.id}/twin`, { title: 'autres tests', body: 'cas...' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'TwinAlreadyWrittenError' })
  })

  it('reports an unknown story as not found', async () => {
    const response = await post('/api/stories/404/twin', { title: 'tests', body: 'cas...' })

    expect(response.status).toBe(404)
  })
})

describe('POST /api/stories/:id/backlog', () => {
  it('refuses a story that has no twin', async () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })

    const response = await post(`/api/stories/${story.id}/backlog`)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'TwinRequiredError' })
  })
})

describe('GET /api/stories/backlog', () => {
  it('lists the stories waiting in the backlog', async () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    repository.writeTwin({ storyId: story.id, title: 'tests visualiser', body: 'cas...' })
    repository.sendToBacklog(story.id)

    const response = await api.request('/api/stories/backlog')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([expect.objectContaining({ reference: 'FORGE-1' })])
  })
})

describe('unexpected failures', () => {
  it('does not disguise a programming error as a domain refusal', async () => {
    const broken = createBoardApi({
      repository: {
        ...repository,
        listBacklog: () => {
          throw new TypeError('lecture sur undefined')
        },
      },
      claudeHome,
    })

    const response = await broken.request('/api/stories/backlog')

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'UnexpectedError' })
  })
})

describe('GET /api/fleet', () => {
  it('reports the daemon roster and the running jobs', async () => {
    mkdirSync(join(claudeHome, 'daemon'), { recursive: true })
    writeFileSync(
      join(claudeHome, 'daemon', 'roster.json'),
      JSON.stringify({ proto: 1, supervisorPid: 815032, updatedAt: 1782887805741, workers: { 'worker-1': {} } }),
      'utf-8',
    )
    mkdirSync(join(claudeHome, 'jobs', 'c3905d1d'), { recursive: true })
    writeFileSync(
      join(claudeHome, 'jobs', 'c3905d1d', 'state.json'),
      JSON.stringify({ state: 'done', cwd: '/home/gaetan/starfleet', tokens: 90343 }),
      'utf-8',
    )

    const response = await api.request('/api/fleet')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      roster: { supervisorPid: 815032, updatedAt: 1782887805741, workerCount: 1 },
      jobs: [expect.objectContaining({ id: 'c3905d1d', state: 'done', tokens: 90343 })],
    })
  })

  it('reports an absent daemon without failing', async () => {
    const response = await api.request('/api/fleet')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ roster: null, jobs: [] })
  })
})
