import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'

let api: Hono
let repository: StoryRepository

const PROJECT = {
  slug: 'forge',
  name: 'Forge',
  repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
  integrationBranch: 'forge',
  colour: '#ff3b00',
}

function post(path: string, body: unknown): Promise<Response> {
  return api.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  repository = createStoryRepository(db)
  api = createBoardApi({
    repository,
    agentSessions: createAgentSessionRepository(db),
    checkpoints: createCheckpointRepository(db, { takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) }),
    criteria: createCriterionRepository(db),
    zones: createZoneRepository(db),
    budget: createBudgetRepository(db),
    events: createEventBus(),
    dispatcher: {
      dispatch: () => Promise.reject(new Error('aucun lanceur dans ce test')),
      countRunning: () => 0,
    },
    claudeHome: mkdtempSync(join(tmpdir(), 'forge-claude-home-')),
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
    advanceReviewCascade: () =>
      Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
  })
})

describe('POST /api/projects', () => {
  it('writes a project', async () => {
    const response = await post('/api/projects', PROJECT)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ slug: 'forge', name: 'Forge' })
  })

  it('refuses a body that does not match the contract', async () => {
    const response = await post('/api/projects', { slug: 'forge' })

    expect(response.status).toBe(422)
  })

  it('reports a duplicate slug as a conflict, not a server error', async () => {
    await post('/api/projects', PROJECT)

    const response = await post('/api/projects', PROJECT)

    expect(response.status).toBe(409)
  })
})

describe('GET /api/projects', () => {
  it('lists the projects', async () => {
    await post('/api/projects', PROJECT)

    const response = await api.request('/api/projects')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([expect.objectContaining({ slug: 'forge' })])
  })

  it('lists nothing on a fresh board', async () => {
    const response = await api.request('/api/projects')

    await expect(response.json()).resolves.toEqual([])
  })
})

describe('POST /api/epics', () => {
  it('writes an epic on a project', async () => {
    const project = (await (await post('/api/projects', PROJECT)).json()) as { id: number }

    const response = await post('/api/epics', {
      projectId: project.id,
      title: 'CRUD Mail',
      businessIntent: 'gerer les mails du client',
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ title: 'CRUD Mail' })
  })

  it('reports an unknown project as a conflict', async () => {
    const response = await post('/api/epics', {
      projectId: 404,
      title: 'CRUD Mail',
      businessIntent: 'gerer',
    })

    expect(response.status).toBe(409)
  })
})

describe('GET /api/projects/:id/epics', () => {
  it('lists the epics of a project with the stories hanging off them', async () => {
    const project = (await (await post('/api/projects', PROJECT)).json()) as { id: number }
    const epic = (await (
      await post('/api/epics', { projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' })
    ).json()) as { id: number }
    repository.writeStory({ epicId: epic.id, title: 'visualiser', body: 'en tant que...' })

    const response = await api.request(`/api/projects/${project.id}/epics`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ title: 'CRUD Mail', storyCount: 1 }),
    ])
  })

  it('counts only the functional stories, never the twins', async () => {
    const project = (await (await post('/api/projects', PROJECT)).json()) as { id: number }
    const epic = (await (
      await post('/api/epics', { projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' })
    ).json()) as { id: number }
    const story = repository.writeStory({ epicId: epic.id, title: 'visualiser', body: 'en tant que...' })
    repository.writeTwin({ storyId: story.id, title: 'tests', body: 'cas...' })

    const response = await api.request(`/api/projects/${project.id}/epics`)

    await expect(response.json()).resolves.toEqual([expect.objectContaining({ storyCount: 1 })])
  })
})
