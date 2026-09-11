import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import {
  createStatisticRepository,
  type StatisticRepository,
} from '../../../src/domain/Statistic/StatisticRepository.js'

let db: Database.Database
let statistics: StatisticRepository
let storyId: number
let reference: string

function openSession(claudeSessionId: string, agentName: string, phase: 'code' | 'review'): void {
  const sessions = createAgentSessionRepository(db)
  sessions.registerSession({
    storyId,
    claudeSessionId,
    phase,
    agentName,
    claudeCodeVersion: '2.1.218',
  })
}

function closeSession(claudeSessionId: string, seconds: number, costUsd: number): void {
  const sessions = createAgentSessionRepository(db)
  sessions.recordUsage(claudeSessionId, { costUsd, inputTokens: 100, outputTokens: 50 })
  sessions.closeSession(claudeSessionId, { exitCode: 0 })
  db.prepare(
    "UPDATE agent_session SET started_at = datetime('now', ?), ended_at = datetime('now') WHERE claude_session_id = ?",
  ).run(`-${seconds} seconds`, claudeSessionId)
}

beforeEach(() => {
  db = openDatabase(':memory:')
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
    businessIntent: 'gerer les mails du client',
  })
  const story = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' })
  storyId = story.id
  reference = story.reference
  statistics = createStatisticRepository(db)
})

describe('listHistory', () => {
  it('is empty on a fresh board', () => {
    expect(statistics.listHistory()).toEqual([])
  })

  it('names the story a session worked on, not just its identifier', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')

    expect(statistics.listHistory()[0]?.storyReference).toBe(reference)
  })

  it('measures how long a closed session took', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')
    closeSession('11111111-1111-1111-1111-111111111111', 90, 1.5)

    expect(statistics.listHistory()[0]?.seconds).toBe(90)
  })

  it('leaves the duration unknown while a session is still open', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')

    expect(statistics.listHistory()[0]?.seconds).toBeNull()
  })

  it('carries the exit class, so a silent success cannot be assumed', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')
    closeSession('11111111-1111-1111-1111-111111111111', 30, 0.5)

    expect(statistics.listHistory()[0]?.outcome).toBe('succeeded')
  })

  it('shows the most recent session first', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')
    closeSession('11111111-1111-1111-1111-111111111111', 600, 1)
    openSession('22222222-2222-2222-2222-222222222222', 'aragorn', 'review')

    expect(statistics.listHistory()[0]?.agentName).toBe('aragorn')
  })
})

describe('summarise', () => {
  it('counts nothing on a fresh board', () => {
    expect(statistics.summarise()).toMatchObject({ sessions: 0, totalCostUsd: 0, totalSeconds: 0 })
  })

  it('adds up what the fleet has cost', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')
    closeSession('11111111-1111-1111-1111-111111111111', 60, 1.25)
    openSession('22222222-2222-2222-2222-222222222222', 'neo', 'review')
    closeSession('22222222-2222-2222-2222-222222222222', 60, 0.75)

    expect(statistics.summarise().totalCostUsd).toBe(2)
  })

  it('ranks the agents by how much they are used', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')
    closeSession('11111111-1111-1111-1111-111111111111', 60, 1)
    openSession('22222222-2222-2222-2222-222222222222', 'neo', 'review')
    closeSession('22222222-2222-2222-2222-222222222222', 60, 1)
    openSession('33333333-3333-3333-3333-333333333333', 'aragorn', 'review')
    closeSession('33333333-3333-3333-3333-333333333333', 60, 1)

    expect(statistics.summarise().agents[0]).toMatchObject({ agentName: 'neo', sessions: 2 })
  })

  it('reports how long each phase takes, so the slow step is visible', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')
    closeSession('11111111-1111-1111-1111-111111111111', 120, 1)

    expect(statistics.summarise().phases).toContainEqual({ phase: 'code', sessions: 1, totalSeconds: 120 })
  })

  it('ignores an open session when adding up the time spent', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')

    expect(statistics.summarise().totalSeconds).toBe(0)
  })

  it('tallies the exit classes', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')
    closeSession('11111111-1111-1111-1111-111111111111', 60, 1)

    expect(statistics.summarise().outcomes).toContainEqual({ outcome: 'succeeded', sessions: 1 })
  })

  it('does not tally a session that has not exited yet', () => {
    openSession('11111111-1111-1111-1111-111111111111', 'neo', 'code')
    closeSession('11111111-1111-1111-1111-111111111111', 60, 1)
    openSession('22222222-2222-2222-2222-222222222222', 'neo', 'review')

    expect(statistics.summarise().outcomes).toEqual([{ outcome: 'succeeded', sessions: 1 }])
  })
})
