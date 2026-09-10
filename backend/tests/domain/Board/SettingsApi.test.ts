import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'

let api: Hono

function put(path: string, body: unknown): Promise<Response> {
  return api.request(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  api = createBoardApi({
    repository: createStoryRepository(db),
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
    claudeHome: mkdtempSync(join(tmpdir(), 'starfleet-claude-home-')),
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
    advanceReviewCascade: () =>
      Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
  })
})

describe('GET /api/settings/budget', () => {
  it('hands out the policy in force, with what the day has spent so far', async () => {
    const response = await api.request('/api/settings/budget')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      policy: { conduct: 'stop' },
      spentUsd: 0,
    })
  })
})

describe('PUT /api/settings/budget', () => {
  it('records the conduct the person chose', async () => {
    const response = await put('/api/settings/budget', {
      capUsd: 30,
      conduct: 'downgrade',
      downgradeModel: 'claude-haiku-4-5-20251001',
      rerouteBaseUrl: null,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ conduct: 'downgrade', capUsd: 30 })
  })

  it('refuses a body that does not match the contract', async () => {
    const response = await put('/api/settings/budget', { capUsd: 30 })

    expect(response.status).toBe(422)
  })

  it('refuses an unknown conduct', async () => {
    const response = await put('/api/settings/budget', {
      capUsd: 30,
      conduct: 'ignorer',
      downgradeModel: 'x',
      rerouteBaseUrl: null,
    })

    expect(response.status).toBe(422)
  })

  it('reports a reroute with nowhere to go as a conflict, not a server error', async () => {
    const response = await put('/api/settings/budget', {
      capUsd: 30,
      conduct: 'reroute',
      downgradeModel: 'x',
      rerouteBaseUrl: null,
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'BudgetPolicyRefusedError' })
  })

  it('keeps the policy readable after it was written', async () => {
    await put('/api/settings/budget', {
      capUsd: 7,
      conduct: 'reroute',
      downgradeModel: 'claude-haiku-4-5-20251001',
      rerouteBaseUrl: 'https://routeur.example',
    })

    const response = await api.request('/api/settings/budget')

    await expect(response.json()).resolves.toMatchObject({
      policy: { capUsd: 7, conduct: 'reroute', rerouteBaseUrl: 'https://routeur.example' },
    })
  })
})
