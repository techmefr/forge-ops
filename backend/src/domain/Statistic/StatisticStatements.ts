import type Database from 'better-sqlite3'
import type { AgentLifecycle, AgentPhase } from '../Agent/AgentSession.js'
import type { OutcomeClass } from '../Agent/SessionOutcome.js'

export type HistoryRow = {
  id: number
  story_id: number
  reference: string
  phase: AgentPhase
  agent_name: string
  lifecycle: AgentLifecycle
  outcome: OutcomeClass | null
  cost_usd: number | null
  input_tokens: number | null
  output_tokens: number | null
  started_at: string
  ended_at: string | null
  seconds: number | null
}

const SECONDS = "CAST(strftime('%s', session.ended_at) - strftime('%s', session.started_at) AS INTEGER)"

export function prepareStatisticStatements(db: Database.Database) {
  return {
    selectHistory: db.prepare<[], HistoryRow>(`
    SELECT
      session.id,
      session.story_id,
      story.reference,
      session.phase,
      session.agent_name,
      session.lifecycle,
      session.outcome,
      session.cost_usd,
      session.input_tokens,
      session.output_tokens,
      session.started_at,
      session.ended_at,
      ${SECONDS} AS seconds
    FROM agent_session AS session
    JOIN story ON story.id = session.story_id
    ORDER BY session.id DESC
  `),

    selectAgents: db.prepare<[], { agent_name: string; sessions: number; seconds: number; cost: number }>(`
    SELECT
      session.agent_name,
      COUNT(*) AS sessions,
      COALESCE(SUM(${SECONDS}), 0) AS seconds,
      COALESCE(SUM(session.cost_usd), 0) AS cost
    FROM agent_session AS session
    GROUP BY session.agent_name
    ORDER BY sessions DESC, session.agent_name ASC
  `),

    selectPhases: db.prepare<[], { phase: AgentPhase; sessions: number; seconds: number }>(`
    SELECT
      session.phase,
      COUNT(*) AS sessions,
      COALESCE(SUM(${SECONDS}), 0) AS seconds
    FROM agent_session AS session
    GROUP BY session.phase
    ORDER BY sessions DESC, session.phase ASC
  `),

    selectOutcomes: db.prepare<[], { outcome: OutcomeClass; sessions: number }>(`
    SELECT session.outcome, COUNT(*) AS sessions
    FROM agent_session AS session
    WHERE session.outcome IS NOT NULL
    GROUP BY session.outcome
    ORDER BY sessions DESC, session.outcome ASC
  `),

    selectTotals: db.prepare<[], { sessions: number; cost: number; seconds: number }>(`
    SELECT
      COUNT(*) AS sessions,
      COALESCE(SUM(session.cost_usd), 0) AS cost,
      COALESCE(SUM(${SECONDS}), 0) AS seconds
    FROM agent_session AS session
  `),
  }
}
