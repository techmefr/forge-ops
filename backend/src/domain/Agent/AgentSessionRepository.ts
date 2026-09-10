import type Database from 'better-sqlite3'
import { classifyOutcome, lifecycleOfOutcome, type OutcomeClass, type SessionExit } from './SessionOutcome.js'
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
  carried_cost_usd: number
}

export type SessionUsage = {
  costUsd: number
  inputTokens: number
  outputTokens: number
}

export type ClosedSession = AgentSession & {
  outcome: OutcomeClass
  statement: string
}

export type AgentSessionRepository = {
  registerSession: (draft: AgentSessionDraft) => AgentSession
  findByClaudeSessionId: (claudeSessionId: string) => AgentSession | null
  latestSessionOf: (storyId: number) => AgentSession | null
  updateLifecycle: (claudeSessionId: string, lifecycle: AgentLifecycle) => AgentSession
  closeSession: (claudeSessionId: string, exit: SessionExit) => ClosedSession
  recordUsage: (claudeSessionId: string, usage: SessionUsage) => AgentSession & SessionUsage
  carryUsage: (claudeSessionId: string) => void
  sumUsage: (storyId: number) => SessionUsage
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
    costUsd: (row.cost_usd ?? 0) + row.carried_cost_usd,
  }
}

export function createAgentSessionRepository(db: Database.Database): AgentSessionRepository {
  const selectStory = db.prepare<[number], { id: number }>('SELECT id FROM story WHERE id = ?')
  const insertSession = db.prepare<[number, string, AgentPhase, string, string]>(
    `INSERT INTO agent_session (story_id, claude_session_id, phase, agent_name, claude_code_version)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const selectLatestOfStory = db.prepare<[number], AgentSessionRow>(
    'SELECT * FROM agent_session WHERE story_id = ? ORDER BY id DESC LIMIT 1',
  )
  const selectSession = db.prepare<[string], AgentSessionRow>(
    'SELECT * FROM agent_session WHERE claude_session_id = ?',
  )
  const updateSessionLifecycle = db.prepare<[AgentLifecycle, string]>(
    'UPDATE agent_session SET lifecycle = ? WHERE claude_session_id = ?',
  )
  const closeSessionRow = db.prepare<[AgentLifecycle, OutcomeClass, string]>(
    `UPDATE agent_session SET lifecycle = ?, outcome = ?, ended_at = datetime('now')
      WHERE claude_session_id = ?`,
  )
  const updateUsage = db.prepare<[number, number, number, string]>(
    `UPDATE agent_session SET cost_usd = ?, input_tokens = ?, output_tokens = ?
      WHERE claude_session_id = ?`,
  )
  const carryRowUsage = db.prepare<[string]>(
    `UPDATE agent_session
        SET carried_cost_usd = carried_cost_usd + COALESCE(cost_usd, 0),
            carried_input_tokens = carried_input_tokens + COALESCE(input_tokens, 0),
            carried_output_tokens = carried_output_tokens + COALESCE(output_tokens, 0),
            cost_usd = NULL,
            input_tokens = NULL,
            output_tokens = NULL
      WHERE claude_session_id = ?`,
  )
  const sumStoryUsage = db.prepare<
    [number],
    { cost_usd: number | null; input_tokens: number | null; output_tokens: number | null }
  >(
    `SELECT SUM(COALESCE(cost_usd, 0) + carried_cost_usd) AS cost_usd,
            SUM(COALESCE(input_tokens, 0) + carried_input_tokens) AS input_tokens,
            SUM(COALESCE(output_tokens, 0) + carried_output_tokens) AS output_tokens
       FROM agent_session WHERE story_id = ?`,
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

  function latestSessionOf(storyId: number): AgentSession | null {
    const row = selectLatestOfStory.get(storyId)
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
    latestSessionOf,

    updateLifecycle: (claudeSessionId, lifecycle) => {
      requireSession(claudeSessionId)
      updateSessionLifecycle.run(lifecycle, claudeSessionId)
      return requireSession(claudeSessionId)
    },

    closeSession: (claudeSessionId, exit) => {
      requireSession(claudeSessionId)
      const verdict = classifyOutcome(exit)
      const lifecycle = lifecycleOfOutcome(verdict.outcome)
      closeSessionRow.run(lifecycle, verdict.outcome, claudeSessionId)
      return { ...requireSession(claudeSessionId), outcome: verdict.outcome, statement: verdict.statement }
    },

    recordUsage: (claudeSessionId, usage) => {
      requireSession(claudeSessionId)
      updateUsage.run(usage.costUsd, usage.inputTokens, usage.outputTokens, claudeSessionId)
      const session = requireSession(claudeSessionId)
      return { ...session, ...usage, costUsd: session.costUsd }
    },

    carryUsage: (claudeSessionId) => {
      requireSession(claudeSessionId)
      carryRowUsage.run(claudeSessionId)
    },

    sumUsage: (storyId) => {
      const row = sumStoryUsage.get(storyId)
      return {
        costUsd: row?.cost_usd ?? 0,
        inputTokens: row?.input_tokens ?? 0,
        outputTokens: row?.output_tokens ?? 0,
      }
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
