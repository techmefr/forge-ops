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
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'

const stubDispatch = {
  dispatch: () => Promise.reject(new Error('aucun lanceur dans ce test')),
  countRunning: () => 0,
}

let api: Hono
let storyId: number

beforeEach(() => {
  const db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails',
  })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' }).id
  stories.writeTwin({ storyId, title: 'tests visualiser les mails', body: 'cas...' })
  createCriterionRepository(db).declareCriterion({
    storyId,
    reference: 'AC-1',
    statement: 'la liste affiche les mails du client',
  })
  api = createBoardApi({
    zones: createZoneRepository(db),
    budget: createBudgetRepository(db),
    repository: stories,
    agentSessions: createAgentSessionRepository(db),
    checkpoints: createCheckpointRepository(db, {
      takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
      readEvidence: () => 'spec_done',
    }),
    criteria: createCriterionRepository(db),
    events: createEventBus(),
    dispatcher: stubDispatch,
    claudeHome: mkdtempSync(join(tmpdir(), 'forge-claude-home-')),
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
    advanceReviewCascade: () =>
      Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
  })
})

describe('POST /api/stories/:id/checkpoints with a shapeless proof', () => {
  it('refuses the proof with the same status as the other refusals', async () => {
    const response = (await api.request(`/api/stories/${storyId}/checkpoints`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'spec_done', evidencePath: '.claude/evidence/FORGE-1/spec.md' }),
    })) as Response

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'EvidenceShapeRefusedError' })
  })
})
