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
import { createDispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'

let api: Hono
let stories: StoryRepository
let storyId: number

function dispatch(id: number, body: unknown): Promise<Response> {
  return api.request(`/api/stories/${id}/dispatch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  const criteria = createCriterionRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/starfleet.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' })
  const story = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' })
  storyId = story.id
  stories.writeTwin({ storyId, title: 'tests visualiser', body: 'cas...' })
  criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'le comportement attendu' })
  api = createBoardApi({
    repository: stories,
    agentSessions: createAgentSessionRepository(db),
    checkpoints: createCheckpointRepository(db),
    criteria,
    zones: createZoneRepository(db),
    events: createEventBus(),
    dispatcher: createDispatcher({
      database: db,
      stories,
      checkpoints: createCheckpointRepository(db),
      sessions: createAgentSessionRepository(db),
      runner: { launch: async () => ({ claudeSessionId: 'fake-session-1' }) },
      concurrencyCap: 2,
      claudeCodeVersion: '2.1.224',
    }),
    claudeHome: mkdtempSync(join(tmpdir(), 'starfleet-claude-home-')),
  })
})

describe('POST /api/stories/:id/dispatch', () => {
  it('launches the phase and answers with the session it obtained', async () => {
    const response = await dispatch(storyId, { phase: 'spec' })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      claudeSessionId: 'fake-session-1',
      phase: 'spec',
      agentName: 'architecte',
    })
  })

  it('reports a phase that is not ready as a conflict, not a server error', async () => {
    const response = await dispatch(storyId, { phase: 'code' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'PhaseNotReadyError' })
  })

  it('refuses an unknown phase on the contract', async () => {
    const response = await dispatch(storyId, { phase: 'deployer' })

    expect(response.status).toBe(422)
  })

  it('reports an unknown story as not found', async () => {
    const response = await dispatch(404, { phase: 'spec' })

    expect(response.status).toBe(404)
  })
})

describe('GET /api/board/phases', () => {
  it('publishes the phase contract the front drives its buttons with', async () => {
    const response = await api.request('/api/board/phases')

    expect(response.status).toBe(200)
    const phases = (await response.json()) as { phase: string; requires: string[] }[]
    expect(phases.map((entry) => entry.phase)).toEqual([
      'spec',
      'architecture',
      'tdd',
      'code',
      'gate',
      'review',
      'ship',
    ])
    expect(phases.at(-1)?.requires).toHaveLength(6)
  })
})
