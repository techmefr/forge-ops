import type Database from 'better-sqlite3'
import { classifyOutcome, lifecycleOfOutcome, type OutcomeClass, type SessionExit } from './SessionOutcome.js'
import { assertConfinedPath } from '../File/ConfinedPath.js'
import type {
  AgentLifecycle,
  AgentPhase,
  AgentSession,
  AgentSessionDraft,
  FileTouchDraft,
  PathConflict,
} from './AgentSession.js'
import { UnknownAgentSessionError } from './AgentViolation.js'
import { STALE_AFTER_SECONDS, type StaleSession } from './Heartbeat.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'
import type { ThreadSession } from '../Conversation/Thread.js'
import type { SessionActivityEntry } from '../../../../contract/BoardContract.js'

export type { SessionActivityEntry }

type AgentSessionRow = {
  id: number
  story_id: number
  claude_session_id: string
  phase: AgentPhase
  agent_name: string
  lifecycle: AgentLifecycle
  claude_code_version: string
  cost_usd: number | null
  context_tokens: number | null
  context_window: number | null
  outcome: OutcomeClass | null
  started_at: string
  ended_at: string | null
}

type StaleSessionRow = AgentSessionRow & {
  silent_for_seconds: number
}

const RUNNING_LIFECYCLES = "('starting', 'working', 'awaiting_human')"

const SILENCE_SECONDS = "(julianday('now') - julianday(COALESCE(last_heartbeat_at, started_at))) * 86400"

export type SessionUsage = {
  costUsd: number
  inputTokens: number
  outputTokens: number
  contextTokens?: number
  contextWindow?: number
}

export type ClosedSession = AgentSession & {
  outcome: OutcomeClass
  statement: string
}

type ThreadSessionRow = {
  claude_session_id: string
  phase: string
  agent_name: string
  started_at: string
}

export type AgentSessionRepository = {
  registerSession: (draft: AgentSessionDraft) => AgentSession
  findByClaudeSessionId: (claudeSessionId: string) => AgentSession | null
  latestSessionOf: (storyId: number) => AgentSession | null
  listSessionsOf: (storyId: number) => readonly ThreadSession[]
  updateLifecycle: (claudeSessionId: string, lifecycle: AgentLifecycle) => AgentSession
  recordHeartbeat: (claudeSessionId: string) => void
  listStaleSessions: (staleAfterSeconds?: number) => readonly StaleSession[]
  closeSession: (claudeSessionId: string, exit: SessionExit) => ClosedSession
  recordUsage: (
    claudeSessionId: string,
    usage: SessionUsage,
  ) => AgentSession & Pick<SessionUsage, 'inputTokens' | 'outputTokens'>
  abandonRunningSessions: () => number
  sumUsage: (storyId: number) => SessionUsage
  listRecentActivity: (storyId: number, limit?: number) => readonly SessionActivityEntry[]
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
    costUsd: row.cost_usd ?? 0,
    contextTokens: row.context_tokens,
    contextWindow: row.context_window,
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
  const selectSessionsOfStory = db.prepare<[number], ThreadSessionRow>(
    `SELECT claude_session_id, phase, agent_name, started_at FROM agent_session
      WHERE story_id = ? ORDER BY started_at, id`,
  )
  const selectSession = db.prepare<[string], AgentSessionRow>(
    'SELECT * FROM agent_session WHERE claude_session_id = ?',
  )
  const updateSessionLifecycle = db.prepare<[AgentLifecycle, string]>(
    'UPDATE agent_session SET lifecycle = ? WHERE claude_session_id = ?',
  )
  const beatHeartbeat = db.prepare<[string]>(
    "UPDATE agent_session SET last_heartbeat_at = datetime('now') WHERE claude_session_id = ?",
  )
  const selectStaleSessions = db.prepare<[number], StaleSessionRow>(
    `SELECT *, ${SILENCE_SECONDS} AS silent_for_seconds FROM agent_session
      WHERE lifecycle IN ${RUNNING_LIFECYCLES} AND ${SILENCE_SECONDS} > ?
      ORDER BY silent_for_seconds DESC`,
  )
  const closeSessionRow = db.prepare<[AgentLifecycle, OutcomeClass, string]>(
    `UPDATE agent_session SET lifecycle = ?, outcome = ?, ended_at = datetime('now')
      WHERE claude_session_id = ?`,
  )
  const updateUsage = db.prepare<[number, number, number, number | null, number | null, string]>(
    `UPDATE agent_session SET cost_usd = ?, input_tokens = ?, output_tokens = ?,
        context_tokens = COALESCE(?, context_tokens), context_window = COALESCE(?, context_window)
      WHERE claude_session_id = ?`,
  )
  const selectRecentActivity = db.prepare<[number, number], AgentSessionRow>(
    'SELECT * FROM agent_session WHERE story_id = ? ORDER BY started_at DESC, id DESC LIMIT ?',
  )
  const abandonRunning = db.prepare(
    `UPDATE agent_session
        SET lifecycle = 'interrupted', outcome = 'interrupted', ended_at = datetime('now')
      WHERE lifecycle IN ('starting', 'working', 'awaiting_human')`,
  )
  const sumStoryUsage = db.prepare<
    [number],
    { cost_usd: number | null; input_tokens: number | null; output_tokens: number | null }
  >(
    `SELECT SUM(COALESCE(cost_usd, 0)) AS cost_usd,
            SUM(COALESCE(input_tokens, 0)) AS input_tokens,
            SUM(COALESCE(output_tokens, 0)) AS output_tokens
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

    listSessionsOf: (storyId) =>
      selectSessionsOfStory.all(storyId).map((row) => ({
        claudeSessionId: row.claude_session_id,
        phase: row.phase,
        agentName: row.agent_name,
        startedAt: row.started_at,
      })),

    updateLifecycle: (claudeSessionId, lifecycle) => {
      requireSession(claudeSessionId)
      updateSessionLifecycle.run(lifecycle, claudeSessionId)
      return requireSession(claudeSessionId)
    },

    recordHeartbeat: (claudeSessionId) => {
      requireSession(claudeSessionId)
      beatHeartbeat.run(claudeSessionId)
    },

    listStaleSessions: (staleAfterSeconds = STALE_AFTER_SECONDS) =>
      selectStaleSessions.all(staleAfterSeconds).map((row) => ({
        ...toAgentSession(row),
        silentForSeconds: row.silent_for_seconds,
      })),

    closeSession: (claudeSessionId, exit) => {
      requireSession(claudeSessionId)
      const verdict = classifyOutcome(exit)
      const lifecycle = lifecycleOfOutcome(verdict.outcome)
      closeSessionRow.run(lifecycle, verdict.outcome, claudeSessionId)
      return { ...requireSession(claudeSessionId), outcome: verdict.outcome, statement: verdict.statement }
    },

    recordUsage: (claudeSessionId, usage) => {
      requireSession(claudeSessionId)
      updateUsage.run(
        usage.costUsd,
        usage.inputTokens,
        usage.outputTokens,
        usage.contextTokens ?? null,
        usage.contextWindow ?? null,
        claudeSessionId,
      )
      return {
        ...requireSession(claudeSessionId),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }
    },

    abandonRunningSessions: () =>
      abandonRunning.run().changes,

    sumUsage: (storyId) => {
      const row = sumStoryUsage.get(storyId)
      return {
        costUsd: row?.cost_usd ?? 0,
        inputTokens: row?.input_tokens ?? 0,
        outputTokens: row?.output_tokens ?? 0,
      }
    },

    listRecentActivity: (storyId, limit = 8) =>
      selectRecentActivity.all(storyId, limit).map((row) => ({
        claudeSessionId: row.claude_session_id,
        phase: row.phase,
        agentName: row.agent_name,
        lifecycle: row.lifecycle,
        outcome: row.outcome,
        startedAt: row.started_at,
        endedAt: row.ended_at,
      })),

    recordFileTouch: (draft) => {
      const path = assertConfinedPath(draft.path)
      const session = requireSession(draft.claudeSessionId)
      insertFileTouch.run(session.storyId, session.id, path)
    },

    listTouchedPaths: (storyId) => selectTouchedPaths.all(storyId).map((row) => row.path),

    listConflictingPaths: () =>
      selectConflictingPaths.all().map((row) => ({
        path: row.path,
        storyIds: selectStoriesTouching.all(row.path).map((touch) => touch.story_id),
      })),
  }
}
