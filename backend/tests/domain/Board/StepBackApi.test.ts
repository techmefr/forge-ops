import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createEventBus, type BoardEvent } from '../../../src/technical/Http/EventBus.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

const stubDispatch = {
  dispatch: () => Promise.reject(new Error('aucun lanceur dans ce test')),
  countRunning: () => 0,
}

let api: Hono
let storyId: number
let sessions: AgentSessionRepository
let published: BoardEvent[]

function prove(name: string): Promise<Response> {
  return api.request(`/api/stories/${storyId}/checkpoints`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, evidencePath: `.claude/evidence/FORGE-1/${name}.md` }),
  }) as Promise<Response>
}

function stepBack(body: unknown): Promise<Response> {
  return api.request(`/api/stories/${storyId}/step-back`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

async function walkToReviewing(): Promise<void> {
  for (const name of ['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified']) {
    const response = await prove(name)
    expect(response.status).toBe(201)
  }
}

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
  sessions = createAgentSessionRepository(db)
  published = []
  const events = createEventBus()
  events.subscribe((event) => {
    published.push(event)
  })
  api = createBoardApi({
    repository: stories,
    agentSessions: sessions,
    checkpoints: createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES, takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) }),
    criteria: createCriterionRepository(db),
    zones: createZoneRepository(db),
    budget: createBudgetRepository(db),
    events,
    dispatcher: stubDispatch,
    claudeHome: mkdtempSync(join(tmpdir(), 'forge-claude-home-')),
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
    advanceReviewCascade: () =>
      Promise.resolve({ dispatched: null, reason: 'pas de cascade dans ce test' }),
  })
})

describe('POST /api/stories/:id/step-back', () => {
  it('walks a story back to an earlier phase', async () => {
    await walkToReviewing()

    const response = await stepBack({ state: 'building', reason: 'la revue a demarre sur le mauvais scope' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      story: { state: 'building' },
      stepBack: {
        fromState: 'reviewing',
        toState: 'building',
        reason: 'la revue a demarre sur le mauvais scope',
        askedBy: 'local',
        revokedCheckpoints: ['build_done', 'verified'],
      },
    })
  })

  it('publishes the step back on the board event stream', async () => {
    await walkToReviewing()
    published = []

    await stepBack({ state: 'building', reason: 'le plan etait faux' })

    expect(published.map((event) => event.name)).toContain('story.stepped_back')
    expect(published.find((event) => event.name === 'story.stepped_back')?.payload).toMatchObject({
      reference: 'FORGE-1',
      fromState: 'reviewing',
      toState: 'building',
      reason: 'le plan etait faux',
      askedBy: 'local',
    })
  })

  it('keeps the step back in the story history', async () => {
    await walkToReviewing()
    await stepBack({ state: 'building', reason: 'le plan etait faux' })

    const ticket = await api.request(`/api/stories/${storyId}/ticket`)

    await expect(ticket.json()).resolves.toMatchObject({
      stepBacks: [{ fromState: 'reviewing', toState: 'building', reason: 'le plan etait faux' }],
    })
  })

  it('stops counting the checkpoints ahead of the new phase as proven', async () => {
    await walkToReviewing()
    await stepBack({ state: 'building', reason: 'le plan etait faux' })

    const dod = await api.request(`/api/stories/${storyId}/dod`)
    const steps = (await dod.json()) as readonly { name: string; proven: boolean }[]

    expect(steps.filter((step) => step.proven).map((step) => step.name)).toEqual([
      'spec_done',
      'arch_done',
      'tests_written',
    ])
  })

  it('lets a revoked checkpoint be proven again', async () => {
    await walkToReviewing()
    await stepBack({ state: 'building', reason: 'le plan etait faux' })

    const again = await prove('build_done')

    expect(again.status).toBe(201)
  })

  it('resets the review cascade when the review is no longer reached', async () => {
    await walkToReviewing()
    sessions.registerSession({
      storyId,
      claudeSessionId: 'sess-review',
      phase: 'review',
      agentName: 'aragorn',
      claudeCodeVersion: '2.0.1',
    })
    const started = await api.request(`/api/stories/${storyId}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lens: 'quality', claudeSessionId: 'sess-review' }),
    })
    expect(started.status).toBe(201)
    await expect(started.json()).resolves.toMatchObject({ lens: 'quality', state: 'running' })

    await stepBack({ state: 'building', reason: 'le plan etait faux' })

    const cascade = await api.request(`/api/stories/${storyId}/review`)
    const passes = (await cascade.json()) as readonly { lens: string; state: string }[]

    expect(passes.every((pass) => pass.state === 'pending')).toBe(true)
  })

  it('refuses a step back with no reason', async () => {
    await walkToReviewing()

    const response = await stepBack({ state: 'building', reason: '   ' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'StepBackReasonRequiredError' })
  })

  it('refuses a step back asked by an agent session', async () => {
    await walkToReviewing()

    const response = await stepBack({
      state: 'building',
      reason: 'le plan etait faux',
      claudeSessionId: 'sess-1',
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'AgentStepBackRefusedError' })
  })

  it('keeps the story and its evidence untouched when the step back is refused', async () => {
    await walkToReviewing()
    await stepBack({ state: 'building', reason: '' })

    const ticket = await api.request(`/api/stories/${storyId}/ticket`)
    const seen = (await ticket.json()) as {
      functional: { state: string }
      dod: readonly { name: string; proven: boolean }[]
      stepBacks: readonly unknown[]
    }

    expect(seen.functional.state).toBe('reviewing')
    expect(seen.stepBacks).toEqual([])
    expect(seen.dod.filter((step) => step.proven).map((step) => step.name)).toEqual([
      'spec_done',
      'arch_done',
      'tests_written',
      'build_done',
      'verified',
    ])
  })

  it('refuses to walk a merged story back', async () => {
    await walkToReviewing()
    await api.request(`/api/stories/${storyId}/done`, { method: 'POST' })

    const response = await stepBack({ state: 'building', reason: 'le merge etait premature' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'StepBackFromDoneError' })
  })

  it('refuses a state that is not behind the current one', async () => {
    await walkToReviewing()

    const response = await stepBack({ state: 'shipping', reason: 'on avance en douce' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'StepBackNotBackwardError' })
  })

  it('refuses an unknown target state', async () => {
    await walkToReviewing()

    const response = await stepBack({ state: 'drafting', reason: 'le plan etait faux' })

    expect(response.status).toBe(422)
  })
})
