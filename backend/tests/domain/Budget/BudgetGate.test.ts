import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createBudgetRepository, type BudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createDispatcher, type Dispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import type { LaunchOrder } from '../../../src/domain/Dispatch/Dispatch.js'
import { BudgetExhaustedError } from '../../../src/domain/Budget/BudgetViolation.js'
import { DEFAULT_BUDGET_POLICY } from '../../../src/domain/Budget/Budget.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'

let db: Database.Database
let stories: StoryRepository
let budget: BudgetRepository
let dispatcher: Dispatcher
let launched: LaunchOrder[]
let storyId: number

function spend(amountUsd: number, sessionId: string): void {
  db.prepare(
    `INSERT INTO agent_session (story_id, claude_session_id, phase, agent_name, claude_code_version, cost_usd, lifecycle, ended_at)
     VALUES (?, ?, 'spec', 'architecte', 'test', ?, 'finished', datetime('now'))`,
  ).run(storyId, sessionId, amountUsd)
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  budget = createBudgetRepository(db)
  launched = []
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser', body: 'en tant que...' }).id
  const sessions = createAgentSessionRepository(db)
  dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db, { takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) }),
    criteria: createCriterionRepository(db),
    sessions,
    budget,
    foremerge: createForemergeRepository(db, { stories }),
    runner: {
      launch: (order) => {
        launched.push(order)
        return Promise.resolve({ claudeSessionId: `session-${launched.length}` })
      },
    },
    concurrencyCap: 3,
    claudeCodeVersion: 'test',
  })
})

describe('le plafond de cout coupe le dispatch', () => {
  it('lance la session tant que le jour reste sous le plafond', async () => {
    budget.writePolicy({ ...DEFAULT_BUDGET_POLICY, capUsd: 10 })
    spend(4, 'une')

    await dispatcher.dispatch({ storyId, phase: 'spec' })

    expect(launched).toHaveLength(1)
  })

  it('refuse le lancement quand le plafond est atteint et que la conduite est de couper', async () => {
    budget.writePolicy({ ...DEFAULT_BUDGET_POLICY, capUsd: 5, conduct: 'stop' })
    spend(5, 'une')

    await expect(dispatcher.dispatch({ storyId, phase: 'spec' })).rejects.toBeInstanceOf(BudgetExhaustedError)
    expect(launched).toHaveLength(0)
  })

  it('repart sur le modele moins cher plutot que de couper, si la personne a choisi la degradation', async () => {
    budget.writePolicy({
      capUsd: 5,
      conduct: 'downgrade',
      downgradeModel: 'claude-haiku-4-5-20251001',
      rerouteBaseUrl: null,
    })
    spend(6, 'une')

    await dispatcher.dispatch({ storyId, phase: 'spec' })

    expect(launched[0]).toMatchObject({ model: 'claude-haiku-4-5-20251001' })
  })

  it('repart chez le routeur plutot que de couper, si la personne a choisi le reroutage', async () => {
    budget.writePolicy({
      capUsd: 5,
      conduct: 'reroute',
      downgradeModel: 'claude-haiku-4-5-20251001',
      rerouteBaseUrl: 'https://routeur.example',
    })
    spend(6, 'une')

    await dispatcher.dispatch({ storyId, phase: 'spec' })

    expect(launched[0]).toMatchObject({ baseUrl: 'https://routeur.example' })
  })

  it('ne nomme ni modele ni routeur quand le jour reste sous le plafond', async () => {
    budget.writePolicy({ ...DEFAULT_BUDGET_POLICY, capUsd: 10 })

    await dispatcher.dispatch({ storyId, phase: 'spec' })

    expect(launched[0]?.model).toBeUndefined()
    expect(launched[0]?.baseUrl).toBeUndefined()
  })

  it('enregistre aucune session quand le plafond a coupe', async () => {
    budget.writePolicy({ ...DEFAULT_BUDGET_POLICY, capUsd: 5, conduct: 'stop' })
    spend(5, 'une')

    await dispatcher.dispatch({ storyId, phase: 'spec' }).catch(() => null)

    expect(dispatcher.countRunning()).toBe(0)
  })
})
