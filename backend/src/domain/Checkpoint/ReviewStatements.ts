import type Database from 'better-sqlite3'
import type { FindingSeverity, ReviewFinding, ReviewLens, ReviewPassState } from './Checkpoint.js'
import type { AgentPhase } from '../Agent/AgentSession.js'

export type PassRow = {
  lens: ReviewLens
  state: ReviewPassState
  agent_name: string | null
}

type FindingRow = {
  id: number
  story_id: number
  lens: ReviewLens
  severity: FindingSeverity
  path: string
  statement: string
}

export type ReviewStatements = ReturnType<typeof prepareReviewStatements>

export function toFinding(row: FindingRow): ReviewFinding {
  return {
    id: row.id,
    storyId: row.story_id,
    lens: row.lens,
    severity: row.severity,
    path: row.path,
    statement: row.statement,
  }
}

export function prepareReviewStatements(db: Database.Database) {
  return {
    selectStory: db.prepare<[number], { id: number }>('SELECT id FROM story WHERE id = ?'),
    selectSession: db.prepare<[string], { id: number }>('SELECT id FROM agent_session WHERE claude_session_id = ?'),
    selectSessionWithPhase: db.prepare<[string], { id: number; phase: AgentPhase }>(
      'SELECT id, phase FROM agent_session WHERE claude_session_id = ?',
    ),
    insertFinding: db.prepare<[number, number, ReviewLens, FindingSeverity, string, number | null, string]>(
      `INSERT INTO review_finding (story_id, agent_session_id, lens, severity, path, line, statement)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ),
    selectFinding: db.prepare<[number], FindingRow>('SELECT * FROM review_finding WHERE id = ?'),
    selectUnresolvedFindings: db.prepare<[number], FindingRow>(
      'SELECT * FROM review_finding WHERE story_id = ? AND resolved_at IS NULL ORDER BY id',
    ),
    selectUnresolvedStrongCount: db.prepare<[number], { total: number }>(
      `SELECT COUNT(*) AS total FROM review_finding
      WHERE story_id = ? AND severity = 'strong' AND resolved_at IS NULL`,
    ),
    updateFindingResolved: db.prepare<[number]>("UPDATE review_finding SET resolved_at = datetime('now') WHERE id = ?"),
    selectPasses: db.prepare<[number], PassRow>(
      `SELECT review_pass.lens AS lens, review_pass.state AS state, agent_session.agent_name AS agent_name
       FROM review_pass
       LEFT JOIN agent_session ON agent_session.id = review_pass.agent_session_id
      WHERE review_pass.story_id = ?`,
    ),
    upsertPassRunning: db.prepare<[number, ReviewLens, number]>(
      `INSERT INTO review_pass (story_id, lens, state, agent_session_id, started_at)
     VALUES (?, ?, 'running', ?, datetime('now'))
     ON CONFLICT (story_id, lens)
       DO UPDATE SET state = 'running', agent_session_id = excluded.agent_session_id, started_at = datetime('now')`,
    ),
    updatePassPassed: db.prepare<[number, ReviewLens]>(
      `UPDATE review_pass SET state = 'passed', finished_at = datetime('now')
      WHERE story_id = ? AND lens = ?`,
    ),
    selectUnresolvedStrongForLens: db.prepare<[number, ReviewLens], { total: number }>(
      `SELECT COUNT(*) AS total FROM review_finding
      WHERE story_id = ? AND lens = ? AND severity = 'strong' AND resolved_at IS NULL`,
    ),
  }
}
