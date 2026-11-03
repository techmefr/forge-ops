import type Database from 'better-sqlite3'
import type { OutcomeClass } from './SessionOutcome.js'
import type { AgentLifecycle, AgentPhase, AgentSession } from './AgentSession.js'

export type AgentSessionRow = {
  id: number
  story_id: number
  claude_session_id: string
  phase: AgentPhase
  agent_name: string
  lifecycle: AgentLifecycle
  claude_code_version: string
  cost_usd: number | null
  cost_base_usd: number
  context_tokens: number | null
  context_window: number | null
  outcome: OutcomeClass | null
  started_at: string
  ended_at: string | null
}

export type StaleSessionRow = AgentSessionRow & {
  silent_for_seconds: number
}

export type ThreadSessionRow = {
  claude_session_id: string
  phase: string
  agent_name: string
  started_at: string
}

export type AgentSessionStatements = ReturnType<typeof prepareAgentSessionStatements>

const RUNNING_LIFECYCLES = "('starting', 'working', 'awaiting_human')"

const SILENCE_SECONDS = "(julianday('now') - julianday(COALESCE(last_heartbeat_at, started_at))) * 86400"

const WAIT_ON_CLOSE = `wait_seconds = wait_seconds + CASE
              WHEN idle_since IS NOT NULL THEN MAX(0, strftime('%s', 'now') - strftime('%s', idle_since))
              ELSE 0 END,
            idle_since = NULL`

export function toAgentSession(row: AgentSessionRow): AgentSession {
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

export function prepareAgentSessionStatements(db: Database.Database) {
  return {
    selectStory: db.prepare<[number], { id: number }>('SELECT id FROM story WHERE id = ?'),
    insertSession: db.prepare<[number, string, AgentPhase, string, string]>(
      `INSERT INTO agent_session (story_id, claude_session_id, phase, agent_name, claude_code_version)
       VALUES (?, ?, ?, ?, ?)`,
    ),
    resumeSessionRow: db.prepare<[number, AgentPhase, string, string, string]>(
      `UPDATE agent_session
          SET story_id = ?, phase = ?, agent_name = ?, claude_code_version = ?,
              lifecycle = 'starting', outcome = NULL, ended_at = NULL,
              last_heartbeat_at = NULL, cost_base_usd = COALESCE(cost_usd, 0),
              wait_seconds = wait_seconds + MAX(0, strftime('%s', 'now') - strftime('%s', COALESCE(idle_since, ended_at, 'now'))),
              idle_since = NULL
        WHERE claude_session_id = ?`,
    ),
    selectLatestOfStory: db.prepare<[number], AgentSessionRow>(
      'SELECT * FROM agent_session WHERE story_id = ? ORDER BY id DESC LIMIT 1',
    ),
    selectSessionsOfStory: db.prepare<[number], ThreadSessionRow>(
      `SELECT claude_session_id, phase, agent_name, started_at FROM agent_session
        WHERE story_id = ? ORDER BY started_at, id`,
    ),
    selectSession: db.prepare<[string], AgentSessionRow>('SELECT * FROM agent_session WHERE claude_session_id = ?'),
    updateSessionLifecycle: db.prepare<[AgentLifecycle, AgentLifecycle, AgentLifecycle, string]>(
      `UPDATE agent_session
          SET lifecycle = ?,
              wait_seconds = wait_seconds + CASE
                WHEN idle_since IS NOT NULL AND ? <> 'awaiting_human'
                THEN MAX(0, strftime('%s', 'now') - strftime('%s', idle_since))
                ELSE 0 END,
              idle_since = CASE WHEN ? = 'awaiting_human' THEN COALESCE(idle_since, datetime('now')) ELSE NULL END
        WHERE claude_session_id = ?`,
    ),
    beatHeartbeat: db.prepare<[string]>(
      "UPDATE agent_session SET last_heartbeat_at = datetime('now') WHERE claude_session_id = ?",
    ),
    selectStaleSessions: db.prepare<[number], StaleSessionRow>(
      `SELECT *, ${SILENCE_SECONDS} AS silent_for_seconds FROM agent_session
        WHERE lifecycle IN ${RUNNING_LIFECYCLES} AND ${SILENCE_SECONDS} > ?
        ORDER BY silent_for_seconds DESC`,
    ),
    closeSessionRow: db.prepare<[AgentLifecycle, OutcomeClass, string]>(
      `UPDATE agent_session
          SET lifecycle = ?, outcome = ?, ended_at = datetime('now'),
              ${WAIT_ON_CLOSE}
        WHERE claude_session_id = ?`,
    ),
    updateUsage: db.prepare<[number, number, number, number | null, number | null, string]>(
      `UPDATE agent_session SET cost_usd = cost_base_usd + ?, input_tokens = ?, output_tokens = ?,
          context_tokens = COALESCE(?, context_tokens), context_window = COALESCE(?, context_window)
        WHERE claude_session_id = ?`,
    ),
    selectRecentActivity: db.prepare<[number, number], AgentSessionRow>(
      'SELECT * FROM agent_session WHERE story_id = ? ORDER BY started_at DESC, id DESC LIMIT ?',
    ),
    abandonRunning: db.prepare(
      `UPDATE agent_session
          SET lifecycle = 'interrupted', outcome = 'interrupted', ended_at = datetime('now'),
              ${WAIT_ON_CLOSE}
        WHERE lifecycle IN ('starting', 'working', 'awaiting_human')`,
    ),
    sumStoryUsage: db.prepare<
      [number],
      { cost_usd: number | null; input_tokens: number | null; output_tokens: number | null }
    >(
      `SELECT SUM(COALESCE(cost_usd, 0)) AS cost_usd,
              SUM(COALESCE(input_tokens, 0)) AS input_tokens,
              SUM(COALESCE(output_tokens, 0)) AS output_tokens
         FROM agent_session WHERE story_id = ?`,
    ),
    ...prepareFileTouchStatements(db),
  }
}

function prepareFileTouchStatements(db: Database.Database) {
  return {
    insertFileTouch: db.prepare<[number, number, string]>(
      'INSERT INTO file_touch (story_id, agent_session_id, path) VALUES (?, ?, ?)',
    ),
    selectTouchedPaths: db.prepare<[number], { path: string }>(
      'SELECT DISTINCT path FROM file_touch WHERE story_id = ? ORDER BY path',
    ),
    selectConflictingPaths: db.prepare<[], { path: string }>(
      'SELECT path FROM file_touch GROUP BY path HAVING COUNT(DISTINCT story_id) > 1 ORDER BY path',
    ),
    selectStoriesTouching: db.prepare<[string], { story_id: number }>(
      'SELECT DISTINCT story_id FROM file_touch WHERE path = ? ORDER BY story_id',
    ),
  }
}
