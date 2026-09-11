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

let db: Database.Database
let stories: StoryRepository
let sessions: AgentSessionRepository
let budget: BudgetRepository
let storyId: number
let hungUp: string[]

function guard(claudeSessionId: string): boolean {
  return stopRunOverCap({ sessions, stories, budget, hangUp: (id) => hungUp.push(id) }, claudeSessionId)
}

function spend(claudeSessionId: string, costUsd: number): void {
  sessions.recordUsage(claudeSessionId, { costUsd, inputTokens: 10, outputTokens: 10 })
}

beforeEach(() => {
  db = openDatabase(':memory:')
  hungUp = []
  stories = createStoryRepository(db)
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
    businessIntent: 'gerer les mails du client',
  })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' }).id
  stories.moveToState(storyId, 'building')
  sessions = createAgentSessionRepository(db)
  budget = createBudgetRepository(db)
  budget.writePolicy({ capUsd: 5, conduct: 'stop', downgradeModel: 'claude-haiku-4-5-20251001', rerouteBaseUrl: null })
  sessions.registerSession({
    storyId,
    claudeSessionId: 'sess-1',
    phase: 'code',
    agentName: 'neo',
    claudeCodeVersion: '2.1.218',
  })
})

describe('stopRunOverCap', () => {
  it('leaves a run under the cap alone', () => {
    spend('sess-1', 1)

    expect(guard('sess-1')).toBe(false)
    expect(sessions.findByClaudeSessionId('sess-1')?.lifecycle).toBe('starting')
    expect(hungUp).toEqual([])
  })

  it('closes a run that crossed the cap mid-flight', () => {
    spend('sess-1', 7)

    expect(guard('sess-1')).toBe(true)
    expect(sessions.findByClaudeSessionId('sess-1')?.lifecycle).toBe('failed')
  })

  it('hangs up on the run it closed', () => {
    spend('sess-1', 7)
    guard('sess-1')

    expect(hungUp).toEqual(['sess-1'])
  })

  it('reports the story as needing a human', () => {
    spend('sess-1', 7)
    guard('sess-1')

    expect(stories.findStory(storyId).state).toBe('escalated')
  })

  it('stops the run only once', () => {
    spend('sess-1', 7)
    guard('sess-1')

    expect(guard('sess-1')).toBe(false)
    expect(hungUp).toEqual(['sess-1'])
  })

  it('leaves the run alone when the conduct is not to stop', () => {
    budget.writePolicy({
      capUsd: 5,
      conduct: 'downgrade',
      downgradeModel: 'claude-haiku-4-5-20251001',
      rerouteBaseUrl: null,
    })
    spend('sess-1', 7)

    expect(guard('sess-1')).toBe(false)
    expect(sessions.findByClaudeSessionId('sess-1')?.lifecycle).toBe('starting')
  })

  it('ignores a session nobody registered', () => {
    expect(guard('sess-404')).toBe(false)
  })
})
