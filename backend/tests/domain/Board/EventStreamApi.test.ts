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
import { createEventBus, type EventBus } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'

let api: Hono
let bus: EventBus
let stories: StoryRepository
let epicId: number

async function readFirstFrame(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (reader === undefined) {
    throw new Error('la reponse ne porte aucun flux')
  }
  const { value } = await reader.read()
  await reader.cancel()
  return new TextDecoder().decode(value)
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  bus = createEventBus()
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/starfleet.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  epicId = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' }).id
  api = createBoardApi({
    repository: stories,
    agentSessions: createAgentSessionRepository(db),
    checkpoints: createCheckpointRepository(db, { takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) }),
    criteria: createCriterionRepository(db),
    zones: createZoneRepository(db),
    budget: createBudgetRepository(db),
    events: bus,
    dispatcher: {
      dispatch: () => Promise.reject(new Error('aucun lanceur dans ce test')),
      countRunning: () => 0,
    },
    claudeHome: mkdtempSync(join(tmpdir(), 'starfleet-claude-home-')),
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
  })
})

describe('GET /api/events', () => {
  it('answers as an event stream', async () => {
    const response = await api.request('/api/events')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    await response.body?.cancel()
  })

  it('carries a published event as a named frame', async () => {
    const response = await api.request('/api/events')
    bus.publish({ name: 'session.dispatched', payload: { reference: 'FORGE-1' } })

    const frame = await readFirstFrame(response)

    expect(frame).toContain('event: session.dispatched')
    expect(frame).toContain('"reference":"FORGE-1"')
  })

  it('subscribes the connected client and lets it go when it leaves', async () => {
    const response = await api.request('/api/events')
    const reader = response.body?.getReader()
    bus.publish({ name: 'ping', payload: {} })
    await reader?.read()

    expect(bus.countSubscribers()).toBe(1)

    await reader?.cancel()

    expect(bus.countSubscribers()).toBe(0)
  })
})

describe('les mutations du board publient sur le flux', () => {
  it('announces a story that has just been written', async () => {
    const response = await api.request('/api/events')

    await api.request('/api/stories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ epicId, title: 'visualiser les mails', body: 'en tant que...' }),
    })

    const frame = await readFirstFrame(response)
    expect(frame).toContain('event: story.written')
    expect(frame).toContain('FORGE-1')
  })

  it('announces a checkpoint that has just been proven', async () => {
    const story = stories.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    stories.writeTwin({ storyId: story.id, title: 'tests', body: 'cas...' })
    await api.request(`/api/stories/${story.id}/criteria`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference: 'AC-1', statement: 'le comportement attendu' }),
    })
    const response = await api.request('/api/events')

    await api.request(`/api/stories/${story.id}/checkpoints`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'spec_done', evidencePath: '.claude/evidence/FORGE-1/spec.md' }),
    })

    const frame = await readFirstFrame(response)
    expect(frame).toContain('event: checkpoint.proven')
    expect(frame).toContain('spec_done')
  })

  it('says nothing on a refused mutation', async () => {
    const story = stories.writeStory({ epicId, title: 'visualiser les mails', body: 'en tant que...' })
    const response = await api.request('/api/events')

    const refused = await api.request(`/api/stories/${story.id}/backlog`, { method: 'POST' })
    expect(refused.status).toBe(409)

    bus.publish({ name: 'sentinelle', payload: {} })
    const frame = await readFirstFrame(response)
    expect(frame).toContain('event: sentinelle')
  })
})
