import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository, type CriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { createDispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { advanceCascade } from '../../../src/domain/Checkpoint/ReviewCascade.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import type { LaunchOrder } from '../../../src/domain/Dispatch/Dispatch.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

let api: Hono
let stories: StoryRepository
let checkpoints: CheckpointRepository
let criteria: CriterionRepository
let sessions: ReturnType<typeof createAgentSessionRepository>
let launched: LaunchOrder[]
let cleanUps: number[]
let epicId: number
let storyId: number

const BODY = [
  'En tant que gestionnaire, je veux voir la liste des mails du client',
  'afin de retrouver un echange sans ouvrir sa boite.',
  '',
  'La liste est paginee par vingt, du plus recent au plus ancien.',
  'Quand le client n a aucun mail, la page le dit.',
].join('\n')

function send(path: string, body?: unknown): Promise<Response> {
  return api.request(path, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  }) as Promise<Response>
}

function prove(name: string): Promise<Response> {
  return send(`/api/stories/${storyId}/checkpoints`, {
    name,
    evidencePath: `.claude/evidence/${name}.md`,
  })
}

function closeLastSession(): void {
  sessions.closeSession(`fake-session-${launched.length}`, { exitCode: 0 })
}

function satisfyCriteria(): void {
  for (const criterion of criteria.listUnmetCriteria(storyId)) {
    criteria.satisfyCriterion(criterion.id, '.claude/evidence/criteria.md')
  }
}

async function walkToShipping(): Promise<void> {
  for (const name of ['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified']) {
    const step = await prove(name)
    expect(step.status).toBe(201)
  }
  closeLastSession()
  await send(`/api/stories/${storyId}/review/quality/pass`)
  closeLastSession()
  await send(`/api/stories/${storyId}/review/security/pass`)
  closeLastSession()
  await send(`/api/stories/${storyId}/review/accessibility/pass`)
  satisfyCriteria()
  await prove('reviewed')
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  sessions = createAgentSessionRepository(db)
  launched = []
  cleanUps = []
  const events = createEventBus()
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' })
  epicId = epic.id
  storyId = stories.writeStory({ epicId, title: 'visualiser les mails du client', body: BODY }).id
  stories.writeTwin({ storyId, title: 'tests visualiser les mails', body: 'cas nominal et cas vide' })
  criteria = createCriterionRepository(db)
  criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'la liste est paginee' })
  criteria.declareCriterion({ storyId, reference: 'AC-2', statement: 'le cas vide est annonce' })
  checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
  })
  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints,
    criteria,
    sessions,
    budget: createBudgetRepository(db),
    foremerge: createForemergeRepository(db, { stories }),
    runner: {
      launch: (order) => {
        launched.push(order)
        return Promise.resolve({ claudeSessionId: `fake-session-${launched.length}` })
      },
    },
    concurrencyCap: 3,
    claudeCodeVersion: '2.1.224',
  })
  api = createBoardApi({
    repository: stories,
    agentSessions: sessions,
    checkpoints,
    criteria,
    zones: createZoneRepository(db),
    budget: createBudgetRepository(db),
    events,
    dispatcher,
    advanceReviewCascade: (target) =>
      advanceCascade({
        cascade: checkpoints.reviewCascade(target),
        dispatchLens: async (lens) => {
          await dispatcher.dispatch({ storyId: target, phase: 'review', lens })
        },
      }),
    cleanUpAfterMerge: (target) => {
      cleanUps.push(target)
      return { scopesReleased: 0, worktreeClosed: true, worktreeRefusal: null }
    },
    claudeHome: mkdtempSync(join(tmpdir(), 'forge-claude-home-')),
  })
})

describe('POST /api/stories/:id/done', () => {
  it('closes the story and cleans up once the cascade is through', async () => {
    await walkToShipping()

    const response = await send(`/api/stories/${storyId}/done`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ story: { state: 'done' } })
    expect(cleanUps).toEqual([storyId])
  })

  it('refuses a story that never left the pipeline and says what is missing', async () => {
    const response = await send(`/api/stories/${storyId}/done`)

    expect(response.status).toBe(409)
    const refusal = (await response.json()) as { error: string; message: string }
    expect(refusal.error).toBe('DoneNotEarnedError')
    expect(refusal.message).toContain('spec_done')
    expect(cleanUps).toEqual([])
  })

  it('leaves the story where it was when it refuses', async () => {
    await send(`/api/stories/${storyId}/done`)

    expect(stories.findStory(storyId).state).not.toBe('done')
  })

  it('names the checkpoints still unproven when the state was forced', async () => {
    stories.moveToState(storyId, 'shipping')

    const response = await send(`/api/stories/${storyId}/done`)

    expect(response.status).toBe(409)
    const refusal = (await response.json()) as { message: string }
    expect(refusal.message).toContain('reviewed')
    expect(cleanUps).toEqual([])
  })

  it('refuses while a strong finding recorded after the review stays unresolved', async () => {
    await walkToShipping()
    checkpoints.recordFinding({
      storyId,
      claudeSessionId: `fake-session-${launched.length}`,
      lens: 'accessibility',
      severity: 'strong',
      path: 'frontend/src/Story/StoryCard.vue',
      statement: 'le bouton icone seul n a pas de nom accessible',
    })

    const response = await send(`/api/stories/${storyId}/done`)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'DoneNotEarnedError' })
    expect(cleanUps).toEqual([])
  })

  it('refuses a delivery that never answered a criterion the epic asked for', async () => {
    await walkToShipping()
    criteria.declareCriterion({
      storyId,
      reference: 'AC-3',
      statement: 'le gestionnaire retrouve un echange par expediteur',
    })

    const response = await send(`/api/stories/${storyId}/done`)

    expect(response.status).toBe(409)
    const refusal = (await response.json()) as { error: string; message: string }
    expect(refusal.error).toBe('DoneNotEarnedError')
    expect(refusal.message).toContain('AC-3')
    expect(cleanUps).toEqual([])
  })

  it('refuses a story carrying no criterion at all, nothing ties it to the epic', async () => {
    const bare = stories.writeStory({ epicId, title: 'un titre', body: BODY }).id
    stories.writeTwin({ storyId: bare, title: 'tests', body: 'cas nominal' })
    for (const name of ['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified']) {
      await send(`/api/stories/${bare}/checkpoints`, {
        name,
        evidencePath: `.claude/evidence/${name}.md`,
      })
    }
    for (const lens of ['quality', 'security', 'accessibility']) {
      const claudeSessionId = `bare-${lens}`
      sessions.registerSession({
        storyId: bare,
        claudeSessionId,
        phase: 'review',
        agentName: 'reader',
        claudeCodeVersion: '2.1.224',
      })
      checkpoints.startLens(bare, lens as 'quality', claudeSessionId)
      sessions.closeSession(claudeSessionId, { exitCode: 0 })
      await send(`/api/stories/${bare}/review/${lens}/pass`)
    }
    await send(`/api/stories/${bare}/checkpoints`, {
      name: 'reviewed',
      evidencePath: '.claude/evidence/reviewed.md',
    })

    const response = await send(`/api/stories/${bare}/done`)

    expect(response.status).toBe(409)
    const refusal = (await response.json()) as { message: string }
    expect(refusal.message).toContain('aucun critere')
  })

  it('refuses an agent hand, closing a story is a human decision', async () => {
    await walkToShipping()

    const response = await send(`/api/stories/${storyId}/done`, { agentName: 'aragorn' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'AgentStepBackRefusedError' })
    expect(cleanUps).toEqual([])
  })

  it('refuses an operator the epic does not belong to', async () => {
    await walkToShipping()
    stories.claimEpic(epicId, 'frodo')
    const signed = new Hono()
    signed.use('*', async (context, next) => {
      context.set('login', 'gollum')
      await next()
    })
    signed.route('/', api)
    api = signed

    const response = await send(`/api/stories/${storyId}/done`)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'StoryNotYoursError' })
    expect(cleanUps).toEqual([])
  })

  it('lets the operator the epic belongs to close it', async () => {
    await walkToShipping()
    stories.claimEpic(epicId, 'frodo')
    const signed = new Hono()
    signed.use('*', async (context, next) => {
      context.set('login', 'frodo')
      await next()
    })
    signed.route('/', api)
    api = signed

    const response = await send(`/api/stories/${storyId}/done`)

    expect(response.status).toBe(200)
    expect(cleanUps).toEqual([storyId])
  })
})
