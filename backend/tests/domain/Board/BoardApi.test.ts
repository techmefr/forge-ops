import { beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

const stubDispatch = {
  dispatch: () => Promise.reject(new Error('aucun lanceur dans ce test')),
  countRunning: () => 0,
}


let api: Hono
let repository: StoryRepository
let epicId: number
let claudeHome: string
let agentSessions: ReturnType<typeof createAgentSessionRepository>
let checkpoints: ReturnType<typeof createCheckpointRepository>
let zones: ReturnType<typeof createZoneRepository>
let criteria: ReturnType<typeof createCriterionRepository>
let budget: ReturnType<typeof createBudgetRepository>

async function post(path: string, body?: unknown): Promise<Response> {
  return await api.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  repository = createStoryRepository(db)
  zones = createZoneRepository(db)
  agentSessions = createAgentSessionRepository(db)
  checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES, takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) })
  criteria = createCriterionRepository(db)
  budget = createBudgetRepository(db)
  const project = repository.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  epicId = repository.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails du client',
  }).id
  claudeHome = mkdtempSync(join(tmpdir(), 'forge-claude-home-'))
  api = createBoardApi({
    repository,
    agentSessions,
    checkpoints,
    criteria,
    zones,
    budget,
    events: createEventBus(),
    dispatcher: stubDispatch,
    claudeHome,
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
    advanceReviewCascade: () =>
      Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
  })
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
      zones,
      budget,
      repository: {
        ...repository,
        listBacklog: () => {
          throw new TypeError('lecture sur undefined')
        },
      },
      agentSessions,
      checkpoints,
      criteria,
      events: createEventBus(),
      dispatcher: stubDispatch,
      claudeHome,
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
    advanceReviewCascade: () =>
      Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
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

describe('GET /api/stories/:id/ticket', () => {
  it('serves both panels of the ticket', async () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    repository.writeTwin({ storyId: story.id, title: 'tests visualiser', body: 'cas...' })

    const response = await api.request(`/api/stories/${story.id}/ticket`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      functional: { reference: 'FORGE-1', kind: 'functional' },
      tests: { reference: 'FORGE-1-T', kind: 'test' },
    })
  })

  it('serves a closed tests panel while the twin is not written', async () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })

    const response = await api.request(`/api/stories/${story.id}/ticket`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ tests: null })
  })

  it('serves the same ticket when asked by the twin identifier', async () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    const twin = repository.writeTwin({ storyId: story.id, title: 'tests visualiser', body: 'cas...' })

    const response = await api.request(`/api/stories/${twin.id}/ticket`)

    await expect(response.json()).resolves.toMatchObject({ functional: { reference: 'FORGE-1' } })
  })

  it('carries the definition of done and the review cascade', async () => {
    const story = repository.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })

    const response = await api.request(`/api/stories/${story.id}/ticket`)

    const ticket = (await response.json()) as { dod: unknown[]; cascade: unknown[] }
    expect(ticket.dod).toHaveLength(6)
    expect(ticket.cascade).toHaveLength(3)
  })

  it('reports an unknown story as not found', async () => {
    const response = await api.request('/api/stories/404/ticket')

    expect(response.status).toBe(404)
  })
})
