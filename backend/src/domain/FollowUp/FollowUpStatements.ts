import type Database from 'better-sqlite3'
import type { ProjectDecision, ProjectRisk, RiskLevel, Weather } from '../../../../contract/FollowUpContract.js'

export type RiskRow = {
  id: number
  project_id: number
  text: string
  level: RiskLevel
  owner: string | null
  epic_id: number | null
  opened_on: string
  closed_on: string | null
}

type DecisionRow = {
  id: number
  project_id: number
  decided_on: string
  text: string
  decided_by: string
}

export type ProjectRow = {
  status_sentence: string | null
  weather_override: Weather | null
}

export type FollowUpStatements = ReturnType<typeof prepareFollowUpStatements>

const RISK_COLUMNS = 'id, project_id, text, level, owner, epic_id, opened_on, closed_on'

export function toRisk(row: RiskRow): ProjectRisk {
  return {
    id: row.id,
    projectId: row.project_id,
    text: row.text,
    level: row.level,
    owner: row.owner,
    epicId: row.epic_id,
    openedOn: row.opened_on,
    closedOn: row.closed_on,
  }
}

export function toDecision(row: DecisionRow): ProjectDecision {
  return {
    id: row.id,
    projectId: row.project_id,
    decidedOn: row.decided_on,
    text: row.text,
    decidedBy: row.decided_by,
  }
}

export function prepareFollowUpStatements(db: Database.Database) {
  return {
    selectProject: db.prepare<[number], ProjectRow>('SELECT status_sentence, weather_override FROM project WHERE id = ?'),
    selectRisksOfProject: db.prepare<[number], RiskRow>(
      `SELECT ${RISK_COLUMNS} FROM project_risk WHERE project_id = ?
      ORDER BY closed_on IS NOT NULL,
               CASE level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
               id DESC`,
    ),
    selectRisk: db.prepare<[number], RiskRow>(`SELECT ${RISK_COLUMNS} FROM project_risk WHERE id = ?`),
    selectDecisionsOfProject: db.prepare<[number], DecisionRow>(
      `SELECT id, project_id, decided_on, text, decided_by FROM project_decision
      WHERE project_id = ? ORDER BY decided_on DESC, id DESC`,
    ),
    selectDecision: db.prepare<[number], DecisionRow>(
      'SELECT id, project_id, decided_on, text, decided_by FROM project_decision WHERE id = ?',
    ),
    selectEpic: db.prepare<[number], { project_id: number; deleted_at: string | null }>(
      'SELECT project_id, deleted_at FROM epic WHERE id = ?',
    ),
    insertRisk: db.prepare<[number, string, RiskLevel, string | null, number | null, string]>(
      `INSERT INTO project_risk (project_id, text, level, owner, epic_id, opened_on) VALUES (?, ?, ?, ?, ?, ?)`,
    ),
    insertDecision: db.prepare<[number, string, string, string]>(
      'INSERT INTO project_decision (project_id, decided_on, text, decided_by) VALUES (?, ?, ?, ?)',
    ),
    updateWeather: db.prepare<[Weather | null, number]>('UPDATE project SET weather_override = ? WHERE id = ?'),
    updateSentence: db.prepare<[string | null, number]>('UPDATE project SET status_sentence = ? WHERE id = ?'),
  }
}
