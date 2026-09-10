import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { REVIEW_LENS_SEQUENCE, type CheckpointName } from '../../../src/domain/Checkpoint/Checkpoint.js'

const CENSUS = { tests: 12, skipped: 0, tautologies: 0 }

let api: Hono
let stories: StoryRepository
let checkpoints: CheckpointRepository
let storyId: number

function evidenceOf(name: string): string {
  return `.claude/evidence/forge-1/${name}.md`
}

function prove(name: CheckpointName): Promise<Response> {
  return api.request(`/api/stories/${storyId}/checkpoints`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, evidencePath: evidenceOf(name) }),
  }) as Promise<Response>
}

function acceptPlan(): Promise<Response> {
  return api.request(`/api/stories/${storyId}/plan/accept`, { method: 'POST' }) as Promise<Response>
}

function stateOf(): string {
  return stories.findStory(storyId).state
}

function passTheWholeCascade(): void {
  const sessions = createAgentSessionRepository(dbOf())
  for (const lens of REVIEW_LENS_SEQUENCE) {
    const claudeSessionId = `lens-${lens}`
    sessions.registerSession({
      storyId,
      claudeSessionId,
      phase: 'review',
      agentName: 'elrond',
      claudeCodeVersion: '2.1.224',
    })
    checkpoints.startLens(storyId, lens, claudeSessionId)
    checkpoints.passLens(storyId, lens)
  }
}

let database: ReturnType<typeof openDatabase>

function dbOf(): ReturnType<typeof openDatabase> {
  return database
}

beforeEach(() => {
  database = openDatabase(':memory:')
  stories = createStoryRepository(database)
  checkpoints = createCheckpointRepository(database, { takeCensus: () => CENSUS })
  const criteria = createCriterionRepository(database)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/starfleet.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'Board de la forge',
    businessIntent: 'suivre les stories',
  })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser le kanban', body: 'en tant que...' }).id
  stories.writeTwin({ storyId, title: 'prouver le kanban', body: 'cas d acceptation' })
  const criterion = criteria.declareCriterion({
    storyId,
    reference: 'FORGE-1-C1',
    statement: 'une colonne vide reste affichee',
  })
  criteria.satisfyCriterion(criterion.id, '.claude/evidence/forge-1/c1.png')
  stories.sendToBacklog(storyId)

  api = createBoardApi({
    zones: createZoneRepository(database),
    budget: createBudgetRepository(database),
    repository: stories,
    agentSessions: createAgentSessionRepository(database),
    checkpoints,
    criteria,
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

describe('a story crossing the board', () => {
  it('starts in the backlog, outside every column', () => {
    expect(stateOf()).toBe('backlog')
  })

  it('goes to the architecture once the spec is proven', async () => {
    await prove('spec_done')

    expect(stateOf()).toBe('architecture')
  })

  it('waits for the human once the plan is settled', async () => {
    await prove('spec_done')
    await prove('arch_done')

    expect(stateOf()).toBe('plan_review')
  })

  it('starts building only when the human accepts the plan', async () => {
    await prove('spec_done')
    await prove('arch_done')
    const response = await acceptPlan()

    expect(response.status).toBe(200)
    expect(stateOf()).toBe('building')
  })

  it('stays in the dev while the tests are written', async () => {
    await prove('spec_done')
    await prove('arch_done')
    await acceptPlan()
    await prove('tests_written')

    expect(stateOf()).toBe('building')
  })

  it('reaches the gate on green tests', async () => {
    await prove('spec_done')
    await prove('arch_done')
    await acceptPlan()
    await prove('tests_written')
    await prove('build_done')

    expect(stateOf()).toBe('gating')
  })

  it('reaches the review once verified', async () => {
    await prove('spec_done')
    await prove('arch_done')
    await acceptPlan()
    await prove('tests_written')
    await prove('build_done')
    await prove('verified')

    expect(stateOf()).toBe('reviewing')
  })

  it('reaches the merge once reviewed', async () => {
    await prove('spec_done')
    await prove('arch_done')
    await acceptPlan()
    await prove('tests_written')
    await prove('build_done')
    await prove('verified')
    passTheWholeCascade()
    await prove('reviewed')

    expect(stateOf()).toBe('shipping')
  })

  it('refuses to accept a plan for a story blocked by another', async () => {
    const other = stories.writeStory({
      epicId: stories.findStory(storyId).epicId,
      title: 'autre story',
      body: 'en tant que...',
    })
    stories.addDependency({ blockedStoryId: storyId, blockingStoryId: other.id })
    await prove('spec_done')
    await prove('arch_done')

    const response = await acceptPlan()

    expect(response.status).toBe(409)
    expect(stateOf()).toBe('plan_review')
  })

  it('refuses to accept a plan that is not settled yet', async () => {
    await prove('spec_done')

    const response = await acceptPlan()

    expect(response.status).toBe(409)
    expect(stateOf()).toBe('architecture')
  })
})
