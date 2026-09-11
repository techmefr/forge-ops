import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { createDispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { advanceCascade } from '../../../src/domain/Checkpoint/ReviewCascade.js'
import { createBoardApi } from '../../../src/domain/Board/BoardApi.js'
import { createEventBus, type BoardEvent } from '../../../src/technical/Http/EventBus.js'
import type { LaunchOrder } from '../../../src/domain/Dispatch/Dispatch.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

let api: Hono
let checkpoints: CheckpointRepository
let criteria: ReturnType<typeof createCriterionRepository>
let sessions: ReturnType<typeof createAgentSessionRepository>
let launched: LaunchOrder[]
let seen: BoardEvent[]
let storyId: number
let cap: number

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

beforeEach(() => {
  const db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  sessions = createAgentSessionRepository(db)
  launched = []
  seen = []
  cap = 20
  const events = createEventBus()
  events.subscribe((event) => seen.push(event))
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' })
  const story = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails du client', body: BODY })
  storyId = story.id
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
        if (launched.length >= cap) {
          return Promise.reject(new Error('la flotte est saturee'))
        }
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
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: false, worktreeRefusal: null }),
    claudeHome: mkdtempSync(join(tmpdir(), 'forge-claude-home-')),
  })
})

async function proveUpToVerified(): Promise<Response> {
  for (const name of ['spec_done', 'arch_done', 'tests_written', 'build_done']) {
    await prove(name)
  }
  return prove('verified')
}

describe('proving the verified checkpoint', () => {
  it('starts the cascade on its own, nobody clicks the first lens', async () => {
    const response = await proveUpToVerified()

    await expect(response.json()).resolves.toMatchObject({ cascade: { dispatched: 'quality' } })
  })

  it('launches the reader that lens belongs to', async () => {
    await proveUpToVerified()

    expect(launched.at(-1)).toMatchObject({ phase: 'review', agentName: 'elrond' })
  })

  it('announces the cascade, so the board follows without polling', async () => {
    await proveUpToVerified()

    expect(seen.map((event) => event.name)).toContain('review.cascade')
  })

  it('leaves the other checkpoints alone, only verified opens the review', async () => {
    await prove('spec_done')

    await expect(prove('arch_done')).resolves.toBeDefined()
    expect(launched).toEqual([])
  })
})

describe('passing a lens', () => {
  it('hands the next lens to the next reader', async () => {
    await proveUpToVerified()
    closeLastSession()

    const response = await send(`/api/stories/${storyId}/review/quality/pass`)

    await expect(response.json()).resolves.toMatchObject({ cascade: { dispatched: 'security' } })
  })

  it('walks the whole cascade without a single manual dispatch', async () => {
    await proveUpToVerified()
    closeLastSession()
    await send(`/api/stories/${storyId}/review/quality/pass`)
    closeLastSession()
    await send(`/api/stories/${storyId}/review/security/pass`)
    closeLastSession()

    expect(launched.map((order) => order.agentName)).toEqual(['elrond', 'seraph', 'link'])
  })

  it('says the cascade is through once the last lens passed', async () => {
    await proveUpToVerified()
    closeLastSession()
    await send(`/api/stories/${storyId}/review/quality/pass`)
    closeLastSession()
    await send(`/api/stories/${storyId}/review/security/pass`)
    closeLastSession()

    const response = await send(`/api/stories/${storyId}/review/accessibility/pass`)

    await expect(response.json()).resolves.toMatchObject({
      cascade: { dispatched: null, reason: 'la cascade est passee en entier' },
    })
  })
})

describe('the severity of an accessibility finding', () => {
  function recordAccessibilityFinding(severity: 'strong' | 'weak'): void {
    checkpoints.recordFinding({
      storyId,
      claudeSessionId: `fake-session-${launched.length}`,
      lens: 'accessibility',
      severity,
      path: 'frontend/src/Story/StoryCard.vue',
      statement: 'le bouton icone seul n a pas de nom accessible',
    })
  }

  function satisfyCriteria(): void {
    for (const criterion of criteria.listUnmetCriteria(storyId)) {
      criteria.satisfyCriterion(criterion.id, '.claude/evidence/criteria.md')
    }
  }

  async function reachAccessibility(severity: 'strong' | 'weak'): Promise<void> {
    await proveUpToVerified()
    closeLastSession()
    await send(`/api/stories/${storyId}/review/quality/pass`)
    closeLastSession()
    await send(`/api/stories/${storyId}/review/security/pass`)
    recordAccessibilityFinding(severity)
    closeLastSession()
  }

  it('refuses the accessibility lens while a strong finding is unresolved', async () => {
    await reachAccessibility('strong')

    const response = await send(`/api/stories/${storyId}/review/accessibility/pass`)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'UnresolvedFindingError' })
  })

  it('leaves the accessibility pass running when a strong finding blocks it', async () => {
    await reachAccessibility('strong')
    await send(`/api/stories/${storyId}/review/accessibility/pass`)

    expect(checkpoints.reviewCascade(storyId)).toMatchObject([
      { lens: 'quality', state: 'passed' },
      { lens: 'security', state: 'passed' },
      { lens: 'accessibility', state: 'running' },
    ])
  })

  it('keeps reviewed closed while a strong accessibility finding stands', async () => {
    await reachAccessibility('strong')
    await send(`/api/stories/${storyId}/review/accessibility/pass`)
    satisfyCriteria()

    const response = await prove('reviewed')

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'UnresolvedFindingError' })
  })

  it('passes the accessibility lens despite a weak finding', async () => {
    await reachAccessibility('weak')

    const response = await send(`/api/stories/${storyId}/review/accessibility/pass`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      lens: 'accessibility',
      state: 'passed',
      cascade: { dispatched: null, reason: 'la cascade est passee en entier' },
    })
  })

  it('opens reviewed once a weak finding is the only one left', async () => {
    await reachAccessibility('weak')
    await send(`/api/stories/${storyId}/review/accessibility/pass`)
    satisfyCriteria()

    const response = await prove('reviewed')

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ name: 'reviewed' })
  })

  it('opens reviewed once the strong accessibility finding is resolved', async () => {
    await reachAccessibility('strong')
    const [finding] = checkpoints.listUnresolvedFindings(storyId)
    checkpoints.resolveFinding(finding?.id ?? 0)
    await send(`/api/stories/${storyId}/review/accessibility/pass`)
    satisfyCriteria()

    const response = await prove('reviewed')

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ name: 'reviewed' })
  })
})

describe('a fleet that cannot take the lens', () => {
  it('keeps the checkpoint and reports the refusal', async () => {
    cap = 0

    const response = await proveUpToVerified()

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      name: 'verified',
      cascade: { dispatched: null, reason: 'la flotte est saturee' },
    })
  })

  it('leaves the cascade pending, it can be picked up later', async () => {
    cap = 0
    await proveUpToVerified()

    expect(checkpoints.reviewCascade(storyId).every((pass) => pass.state === 'pending')).toBe(true)
  })
})
