import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import { STALE_AFTER_SECONDS } from '../../../src/domain/Agent/Heartbeat.js'
import { buildTestBoard } from './TestBoard.js'

let db: Database.Database
let api: Hono
let stories: StoryRepository
let sessions: AgentSessionRepository
let storyId: number

function silenceFor(claudeSessionId: string, seconds: number): void {
  db.prepare<[string, string]>(
    "UPDATE agent_session SET last_heartbeat_at = datetime('now', ?) WHERE claude_session_id = ?",
  ).run(`-${seconds} seconds`, claudeSessionId)
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  sessions = createAgentSessionRepository(db)
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
  sessions.registerSession({
    storyId,
    claudeSessionId: 'sess-dead',
    phase: 'code',
    agentName: 'neo',
    claudeCodeVersion: '2.1.218',
  })
  api = buildTestBoard(db).api
})

describe('GET /api/sessions/stale', () => {
  it('names the sessions whose silence exceeds the threshold', async () => {
    silenceFor('sess-dead', STALE_AFTER_SECONDS + 60)

    const response = await api.request('/api/sessions/stale')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      staleAfterSeconds: STALE_AFTER_SECONDS,
      sessions: [{ claudeSessionId: 'sess-dead', phase: 'code' }],
    })
  })

  it('names nobody while the session keeps speaking', async () => {
    const response = await api.request('/api/sessions/stale')

    await expect(response.json()).resolves.toMatchObject({ sessions: [] })
  })
})

describe('POST /api/hooks', () => {
  it('takes a tool call as a sign of life', async () => {
    silenceFor('sess-dead', STALE_AFTER_SECONDS + 60)

    await api.request('/api/hooks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        session_id: 'sess-dead',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: {},
        cwd: '/home/gaetan/forge-ops',
      }),
    })

    expect(sessions.listStaleSessions()).toEqual([])
  })
})

describe('GET /api/board/kanban', () => {
  it('reports a story stranded by a dead session as needing a human', async () => {
    silenceFor('sess-dead', STALE_AFTER_SECONDS + 60)

    await api.request('/api/board/kanban')

    expect(stories.findStory(storyId).state).toBe('escalated')
    expect(sessions.findByClaudeSessionId('sess-dead')?.lifecycle).toBe('failed')
  })

  it('leaves a story alone while its session still speaks', async () => {
    await api.request('/api/board/kanban')

    expect(stories.findStory(storyId).state).toBe('building')
  })
})
