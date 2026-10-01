import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createBudgetRepository, type BudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { stopRunOverCap } from '../../../src/domain/Budget/CostGuard.js'
import { createWorkflowColumnRepository } from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import { createForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import {
  createForgeBoardRepository,
  type ForgeBoardRepository,
} from '../../../src/domain/ForgeCard/ForgeBoardRepository.js'
import type { WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'

const STEP: WorkflowColumnDraft = {
  label: 'Build',
  colour: 'acc',
  provider: 'claude',
  model: 'claude-sonnet-5',
  effort: 'high',
  agentName: '',
  command: '',
  preprompt: '',
  autoStart: true,
}

let db: Database.Database
let stories: StoryRepository
let sessions: AgentSessionRepository
let budget: BudgetRepository
let board: ForgeBoardRepository
let storyId: number
let cardId: number
let stepId: number

function place(): void {
  stories.setPlacement(storyId, { state: 'building', workflowColumnId: stepId })
}

function start(claudeSessionId = 'sess-1'): void {
  sessions.registerSession({ storyId, claudeSessionId, phase: 'code', agentName: 'neo', claudeCodeVersion: '2.1.218' })
}

function age(column: 'started_at' | 'idle_since' | 'ended_at', seconds: number): void {
  db.prepare(`UPDATE agent_session SET ${column} = datetime('now', ?) WHERE claude_session_id = 'sess-1'`).run(
    `-${seconds} seconds`,
  )
}

beforeEach(() => {
  db = openDatabase(':memory:')
  const forgeCards = createForgeCardRepository(db)
  stories = createStoryRepository(db, { onBacklog: (story) => forgeCards.attachCardToStory(story.id) })
  sessions = createAgentSessionRepository(db)
  budget = createBudgetRepository(db)
  const columns = createWorkflowColumnRepository(db)
  const projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  const epicId = stories.createEpic({ projectId, title: 'CRUD Mail', businessIntent: 'manage' }).id
  stepId = columns.create(projectId, STEP).id
  storyId = stories.writeStory({ epicId, title: 'see the mails for the customer', body: 'body' }).id
  stories.writeTwin({ storyId, title: 'tests', body: 'cases' })
  stories.sendToBacklog(storyId)
  board = createForgeBoardRepository(db, { forgeCards, columns })
  cardId = board.list(projectId)[0]?.id ?? 0
  place()
})

describe('the budget cap on a running card', () => {
  it('keeps the card in its step and marks it budget exhausted so Retry can resume it', () => {
    start()
    budget.writePolicy({ capUsd: 5, conduct: 'stop', downgradeModel: 'claude-haiku-4-5-20251001', rerouteBaseUrl: null })
    sessions.recordUsage('sess-1', { costUsd: 7, inputTokens: 1, outputTokens: 1 })

    stopRunOverCap({ sessions, budget, hangUp: () => undefined }, 'sess-1')

    expect(board.view(cardId)).toMatchObject({ stepKey: 'build', status: 'budget_exhausted' })
  })
})

describe('the duration of a card', () => {
  it('stops counting when the agent finishes its turn and waits for the human', () => {
    start()
    age('started_at', 100)
    sessions.updateLifecycle('sess-1', 'awaiting_human')
    age('idle_since', 40)
    const afterTurn = board.view(cardId).durationSeconds

    db.prepare("UPDATE agent_session SET started_at = datetime(started_at, '-300 seconds'), idle_since = datetime(idle_since, '-300 seconds')").run()

    expect(board.view(cardId).durationSeconds).toBe(afterTurn)
    expect(afterTurn).toBeGreaterThanOrEqual(59)
    expect(afterTurn).toBeLessThanOrEqual(61)
  })

  it('excludes the wait when the human answers and the agent works again', () => {
    start()
    age('started_at', 100)
    sessions.updateLifecycle('sess-1', 'awaiting_human')
    age('idle_since', 40)
    sessions.updateLifecycle('sess-1', 'working')

    const seconds = board.view(cardId).durationSeconds

    expect(seconds).toBeGreaterThanOrEqual(59)
    expect(seconds).toBeLessThanOrEqual(62)
  })

  it('does not count the wait either when the session is closed while waiting', () => {
    start()
    age('started_at', 100)
    sessions.updateLifecycle('sess-1', 'awaiting_human')
    age('idle_since', 40)
    sessions.closeSession('sess-1', { exitCode: null, signal: 'SIGTERM' })

    const seconds = board.view(cardId).durationSeconds

    expect(seconds).toBeGreaterThanOrEqual(59)
    expect(seconds).toBeLessThanOrEqual(62)
  })

  it('keeps counting while the agent works', () => {
    start()
    age('started_at', 100)
    sessions.updateLifecycle('sess-1', 'working')

    expect(board.view(cardId).durationSeconds).toBeGreaterThanOrEqual(100)
  })
})

describe('the status after a stop', () => {
  it('shows stopped rather than failed once the user stopped the session', () => {
    start()
    sessions.closeSession('sess-1', { exitCode: null, signal: 'SIGTERM' })

    expect(board.view(cardId).status).toBe('stopped')
  })
})
