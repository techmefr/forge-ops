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
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createEventBus, type BoardEvent } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

let api: Hono
let stories: StoryRepository
let ids: number[]
let seen: BoardEvent[]

function post(path: string, body?: unknown): Promise<Response> {
  return api.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  const db = openDatabase(':memory:')
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
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  ids = ['une', 'deux', 'trois'].map(
    (title) => stories.writeStory({ epicId: epic.id, title, body: 'en tant que...' }).id,
  )
  api = createBoardApi({
    repository: stories,
    agentSessions: createAgentSessionRepository(db),
    checkpoints: createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES, takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) }),
    criteria: createCriterionRepository(db),
    zones: createZoneRepository(db),
    budget: createBudgetRepository(db),
    events,
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

describe('POST /api/stories/:id/dependencies', () => {
  it('records that a story waits on another', async () => {
    const response = await post(`/api/stories/${ids[0]}/dependencies`, { blockingStoryId: ids[1] })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ blockers: ['FORGE-2'] })
  })

  it('reports a cycle as a conflict, not a server error', async () => {
    await post(`/api/stories/${ids[0]}/dependencies`, { blockingStoryId: ids[1] })

    const response = await post(`/api/stories/${ids[1]}/dependencies`, { blockingStoryId: ids[0] })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'DependencyCycleError' })
  })

  it('reports a story waiting on itself as a conflict', async () => {
    const response = await post(`/api/stories/${ids[0]}/dependencies`, { blockingStoryId: ids[0] })

    expect(response.status).toBe(409)
  })

  it('reports an unknown blocking story as not found', async () => {
    const response = await post(`/api/stories/${ids[0]}/dependencies`, { blockingStoryId: 404 })

    expect(response.status).toBe(404)
  })

  it('refuses a body without a blocking story', async () => {
    const response = await post(`/api/stories/${ids[0]}/dependencies`, {})

    expect(response.status).toBe(422)
  })
})

describe('GET /api/stories/:id/blockers', () => {
  it('lists what a story still waits on', async () => {
    await post(`/api/stories/${ids[0]}/dependencies`, { blockingStoryId: ids[1] })

    const response = await api.request(`/api/stories/${ids[0]}/blockers`)

    await expect(response.json()).resolves.toEqual({ blockers: ['FORGE-2'] })
  })
})

describe('POST /api/stories/:id/done', () => {
  it('closes the story and names what it freed', async () => {
    await post(`/api/stories/${ids[0]}/dependencies`, { blockingStoryId: ids[1] })

    const response = await post(`/api/stories/${ids[1]}/done`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      story: { state: 'done' },
      unblocked: [{ reference: 'FORGE-1' }],
    })
  })

  it('tells the board about every story it freed', async () => {
    await post(`/api/stories/${ids[0]}/dependencies`, { blockingStoryId: ids[1] })

    await post(`/api/stories/${ids[1]}/done`)

    expect(seen.filter((event) => event.name === 'story.unblocked')).toHaveLength(1)
  })

  it('frees nothing when the story still had a sibling blocker', async () => {
    await post(`/api/stories/${ids[0]}/dependencies`, { blockingStoryId: ids[1] })
    await post(`/api/stories/${ids[0]}/dependencies`, { blockingStoryId: ids[2] })

    const response = await post(`/api/stories/${ids[1]}/done`)

    await expect(response.json()).resolves.toMatchObject({ unblocked: [] })
  })
})
