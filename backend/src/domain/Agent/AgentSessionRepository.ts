import type Database from 'better-sqlite3'
import type {
  AgentLifecycle,
  AgentPhase,
  AgentSession,
  AgentSessionDraft,
  FileTouchDraft,
  PathConflict,
} from './AgentSession.js'
import { UnknownAgentSessionError } from './AgentViolation.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'

type AgentSessionRow = {
  id: number
  story_id: number
  claude_session_id: string
  phase: AgentPhase
  agent_name: string
  lifecycle: AgentLifecycle
  claude_code_version: string
  cost_usd: number | null
}

export type AgentSessionRepository = {
  registerSession: (draft: AgentSessionDraft) => AgentSession
  findByClaudeSessionId: (claudeSessionId: string) => AgentSession | null
  updateLifecycle: (claudeSessionId: string, lifecycle: AgentLifecycle) => AgentSession
  recordFileTouch: (draft: FileTouchDraft) => void
  listTouchedPaths: (storyId: number) => readonly string[]
  listConflictingPaths: () => readonly PathConflict[]
}

function toAgentSession(row: AgentSessionRow): AgentSession {
  return {
    id: row.id,
    storyId: row.story_id,
    claudeSessionId: row.claude_session_id,
    phase: row.phase,
    agentName: row.agent_name,
    lifecycle: row.lifecycle,
    claudeCodeVersion: row.claude_code_version,
    costUsd: row.cost_usd,
  }
}

export function createAgentSessionRepository(db: Database.Database): AgentSessionRepository {
  const selectStory = db.prepare<[number], { id: number }>('SELECT id FROM story WHERE id = ?')
  const insertSession = db.prepare<[number, string, AgentPhase, string, string]>(
    `INSERT INTO agent_session (story_id, claude_session_id, phase, agent_name, claude_code_version)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const selectSession = db.prepare<[string], AgentSessionRow>(
    'SELECT * FROM agent_session WHERE claude_session_id = ?',
  )
  const updateSessionLifecycle = db.prepare<[AgentLifecycle, string]>(
    'UPDATE agent_session SET lifecycle = ? WHERE claude_session_id = ?',
  )
  const insertFileTouch = db.prepare<[number, number, string]>(
    'INSERT INTO file_touch (story_id, agent_session_id, path) VALUES (?, ?, ?)',
  )
  const selectTouchedPaths = db.prepare<[number], { path: string }>(
    'SELECT DISTINCT path FROM file_touch WHERE story_id = ? ORDER BY path',
  )
  const selectConflictingPaths = db.prepare<[], { path: string }>(
    'SELECT path FROM file_touch GROUP BY path HAVING COUNT(DISTINCT story_id) > 1 ORDER BY path',
  )
  const selectStoriesTouching = db.prepare<[string], { story_id: number }>(
    'SELECT DISTINCT story_id FROM file_touch WHERE path = ? ORDER BY story_id',
  )

  function findByClaudeSessionId(claudeSessionId: string): AgentSession | null {
    const row = selectSession.get(claudeSessionId)
    return row === undefined ? null : toAgentSession(row)
  }

  function requireSession(claudeSessionId: string): AgentSession {
    const session = findByClaudeSessionId(claudeSessionId)
    if (session === null) {
      throw new UnknownAgentSessionError(claudeSessionId)
    }
    return session
  }

  return {
    registerSession: (draft) => {
      if (selectStory.get(draft.storyId) === undefined) {
        throw new StoryNotFoundError(draft.storyId)
      }
      insertSession.run(draft.storyId, draft.claudeSessionId, draft.phase, draft.agentName, draft.claudeCodeVersion)
      return requireSession(draft.claudeSessionId)
    },

    findByClaudeSessionId,

    updateLifecycle: (claudeSessionId, lifecycle) => {
      requireSession(claudeSessionId)
      updateSessionLifecycle.run(lifecycle, claudeSessionId)
      return requireSession(claudeSessionId)
    },

    recordFileTouch: (draft) => {
      const session = requireSession(draft.claudeSessionId)
      insertFileTouch.run(session.storyId, session.id, draft.path)
    },

    listTouchedPaths: (storyId) => selectTouchedPaths.all(storyId).map((row) => row.path),

    listConflictingPaths: () =>
      selectConflictingPaths.all().map((row) => ({
        path: row.path,
        storyIds: selectStoriesTouching.all(row.path).map((touch) => touch.story_id),
      })),
  }
}
