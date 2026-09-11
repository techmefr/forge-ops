import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import { reapStaleSessions, STALE_AFTER_SECONDS } from '../../../src/domain/Agent/Heartbeat.js'
import { UnknownAgentSessionError } from '../../../src/domain/Agent/AgentViolation.js'

let db: Database.Database
let stories: StoryRepository
let sessions: AgentSessionRepository
let storyId: number

function silenceFor(claudeSessionId: string, seconds: number): void {
  db.prepare<[string, string]>(
    "UPDATE agent_session SET last_heartbeat_at = datetime('now', ?) WHERE claude_session_id = ?",
  ).run(`-${seconds} seconds`, claudeSessionId)
}

function openSession(claudeSessionId: string): void {
  sessions.registerSession({
    storyId,
    claudeSessionId,
    phase: 'code',
    agentName: 'neo',
    claudeCodeVersion: '2.1.218',
  })
}

beforeEach(() => {
  db = openDatabase(':memory:')
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
})

describe('recordHeartbeat', () => {
  it('breaks the silence of a session that had gone quiet', () => {
    openSession('sess-quiet')
    silenceFor('sess-quiet', STALE_AFTER_SECONDS * 2)

    sessions.recordHeartbeat('sess-quiet')

    expect(sessions.listStaleSessions()).toEqual([])
  })

  it('refuses a heartbeat from a session nobody registered', () => {
    expect(() => sessions.recordHeartbeat('sess-ghost')).toThrow(UnknownAgentSessionError)
  })
})

describe('listStaleSessions', () => {
  it('names a session whose silence exceeds the threshold', () => {
    openSession('sess-dead')
    silenceFor('sess-dead', STALE_AFTER_SECONDS + 60)

    const stale = sessions.listStaleSessions()

    expect(stale).toHaveLength(1)
    expect(stale[0]?.claudeSessionId).toBe('sess-dead')
    expect(stale[0]?.silentForSeconds).toBeGreaterThanOrEqual(STALE_AFTER_SECONDS)
  })

  it('leaves a session that just spoke out of the list', () => {
    openSession('sess-live')
    silenceFor('sess-live', STALE_AFTER_SECONDS - 60)

    expect(sessions.listStaleSessions()).toEqual([])
  })

  it('leaves a session that already ended out of the list', () => {
    openSession('sess-over')
    sessions.closeSession('sess-over', { exitCode: 0 })
    silenceFor('sess-over', STALE_AFTER_SECONDS * 3)

    expect(sessions.listStaleSessions()).toEqual([])
  })

  it('measures a session that never spoke from the moment it started', () => {
    openSession('sess-mute')
    db.prepare<[string, string]>(
      "UPDATE agent_session SET started_at = datetime('now', ?), last_heartbeat_at = NULL WHERE claude_session_id = ?",
    ).run(`-${STALE_AFTER_SECONDS + 60} seconds`, 'sess-mute')

    expect(sessions.listStaleSessions()).toHaveLength(1)
  })

  it('accepts a threshold stated by the caller', () => {
    openSession('sess-slow')
    silenceFor('sess-slow', 120)

    expect(sessions.listStaleSessions(60)).toHaveLength(1)
  })
})

describe('reapStaleSessions', () => {
  it('marks a silent session dead', () => {
    openSession('sess-dead')
    silenceFor('sess-dead', STALE_AFTER_SECONDS + 60)

    reapStaleSessions({ sessions, stories })

    expect(sessions.findByClaudeSessionId('sess-dead')?.lifecycle).toBe('failed')
  })

  it('reports the story as needing a human instead of advancing it', () => {
    openSession('sess-dead')
    silenceFor('sess-dead', STALE_AFTER_SECONDS + 60)

    reapStaleSessions({ sessions, stories })

    expect(stories.findStory(storyId).state).toBe('escalated')
  })

  it('states which session went silent and for how long', () => {
    openSession('sess-dead')
    silenceFor('sess-dead', STALE_AFTER_SECONDS + 60)

    const reaped = reapStaleSessions({ sessions, stories })

    expect(reaped).toHaveLength(1)
    expect(reaped[0]?.claudeSessionId).toBe('sess-dead')
    expect(reaped[0]?.phase).toBe('code')
    expect(reaped[0]?.silentForSeconds).toBeGreaterThanOrEqual(STALE_AFTER_SECONDS)
    expect(reaped[0]?.statement).toContain('silence')
  })

  it('leaves a live session and its story alone', () => {
    openSession('sess-live')

    expect(reapStaleSessions({ sessions, stories })).toEqual([])
    expect(stories.findStory(storyId).state).toBe('building')
  })

  it('reaps nothing twice', () => {
    openSession('sess-dead')
    silenceFor('sess-dead', STALE_AFTER_SECONDS + 60)
    reapStaleSessions({ sessions, stories })

    expect(reapStaleSessions({ sessions, stories })).toEqual([])
  })
})
