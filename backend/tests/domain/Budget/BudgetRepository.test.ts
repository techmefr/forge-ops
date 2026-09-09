import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createBudgetRepository, type BudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { DEFAULT_BUDGET_POLICY } from '../../../src/domain/Budget/Budget.js'
import { BudgetPolicyRefusedError } from '../../../src/domain/Budget/BudgetViolation.js'

let db: Database.Database
let budget: BudgetRepository

function spend(amountUsd: number, sessionId: string): void {
  db.prepare(
    `INSERT INTO agent_session (story_id, claude_session_id, phase, agent_name, claude_code_version, cost_usd)
     VALUES (?, ?, 'spec', 'architecte', 'test', ?)`,
  ).run(1, sessionId, amountUsd)
}

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  stories.writeStory({ epicId: epic.id, title: 'visualiser', body: 'en tant que...' })
  budget = createBudgetRepository(db)
})

describe('readPolicy', () => {
  it('hands out a policy that stops, so a fresh board never overspends by default', () => {
    expect(budget.readPolicy()).toEqual(DEFAULT_BUDGET_POLICY)
    expect(DEFAULT_BUDGET_POLICY.conduct).toBe('stop')
  })

  it('reads back the policy the person chose', () => {
    budget.writePolicy({ capUsd: 12.5, conduct: 'downgrade', downgradeModel: 'claude-haiku-4-5-20251001', rerouteBaseUrl: null })

    expect(budget.readPolicy()).toMatchObject({ capUsd: 12.5, conduct: 'downgrade' })
  })
})

describe('writePolicy', () => {
  it('refuses a cap that is not a positive amount', () => {
    expect(() => budget.writePolicy({ ...DEFAULT_BUDGET_POLICY, capUsd: 0 })).toThrow(BudgetPolicyRefusedError)
  })

  it('refuses a reroute with nowhere to reroute to', () => {
    expect(() =>
      budget.writePolicy({ ...DEFAULT_BUDGET_POLICY, conduct: 'reroute', rerouteBaseUrl: null }),
    ).toThrow(BudgetPolicyRefusedError)
  })

  it('refuses a downgrade with no cheaper model named', () => {
    expect(() =>
      budget.writePolicy({ ...DEFAULT_BUDGET_POLICY, conduct: 'downgrade', downgradeModel: '' }),
    ).toThrow(BudgetPolicyRefusedError)
  })

  it('refuses a reroute pointing anywhere but https, so a token never leaves in clear', () => {
    expect(() =>
      budget.writePolicy({
        ...DEFAULT_BUDGET_POLICY,
        conduct: 'reroute',
        rerouteBaseUrl: 'http://routeur.example',
      }),
    ).toThrow(BudgetPolicyRefusedError)
  })
})

describe('spentToday', () => {
  it('counts nothing on a board that never launched a session', () => {
    expect(budget.spentToday()).toBe(0)
  })

  it('adds up what the sessions of the day cost', () => {
    spend(1.25, 'une')
    spend(0.75, 'deux')

    expect(budget.spentToday()).toBe(2)
  })

  it('ignores a session that has not reported a cost yet', () => {
    spend(1, 'une')
    db.prepare(
      `INSERT INTO agent_session (story_id, claude_session_id, phase, agent_name, claude_code_version)
       VALUES (1, 'sans-cout', 'spec', 'architecte', 'test')`,
    ).run()

    expect(budget.spentToday()).toBe(1)
  })

  it('leaves out what was spent on an earlier day', () => {
    spend(3, 'hier')
    db.prepare("UPDATE agent_session SET started_at = datetime('now', '-2 days') WHERE claude_session_id = 'hier'").run()

    expect(budget.spentToday()).toBe(0)
  })
})

describe('decideConduct', () => {
  it('lets a session through while the day is still under the cap', () => {
    budget.writePolicy({ ...DEFAULT_BUDGET_POLICY, capUsd: 10 })
    spend(4, 'une')

    expect(budget.decideConduct()).toEqual({ conduct: 'proceed', spentUsd: 4, capUsd: 10 })
  })

  it('applies the chosen conduct once the cap is reached, not once it is passed', () => {
    budget.writePolicy({ ...DEFAULT_BUDGET_POLICY, capUsd: 10 })
    spend(10, 'une')

    expect(budget.decideConduct().conduct).toBe('stop')
  })

  it('hands back the downgrade the person chose, with the model to fall back on', () => {
    budget.writePolicy({
      capUsd: 5,
      conduct: 'downgrade',
      downgradeModel: 'claude-haiku-4-5-20251001',
      rerouteBaseUrl: null,
    })
    spend(6, 'une')

    expect(budget.decideConduct()).toMatchObject({
      conduct: 'downgrade',
      model: 'claude-haiku-4-5-20251001',
    })
  })

  it('hands back the reroute the person chose, with where to reroute to', () => {
    budget.writePolicy({
      capUsd: 5,
      conduct: 'reroute',
      downgradeModel: 'claude-haiku-4-5-20251001',
      rerouteBaseUrl: 'https://routeur.example',
    })
    spend(6, 'une')

    expect(budget.decideConduct()).toMatchObject({
      conduct: 'reroute',
      baseUrl: 'https://routeur.example',
    })
  })
})
