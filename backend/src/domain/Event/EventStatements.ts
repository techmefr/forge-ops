import type Database from 'better-sqlite3'
import type { EventType, ProjectEvent } from '../../../../contract/EventContract.js'

type EventRow = {
  id: number
  kind: EventType
  due_on: string
  title: string
  project_id: number
  epic_id: number | null
  note: string | null
  minutes: string | null
  minutes_updated_at: string | null
}

export type EventStatements = ReturnType<typeof prepareEventStatements>

const COLUMNS = `epic_milestone.id AS id, epic_milestone.kind AS kind, epic_milestone.due_on AS due_on,
       epic_milestone.title AS title,
       COALESCE(epic_milestone.project_id, epic.project_id) AS project_id,
       epic_milestone.epic_id AS epic_id, epic_milestone.note AS note,
       epic_milestone.minutes AS minutes, epic_milestone.minutes_updated_at AS minutes_updated_at`

const FROM = 'FROM epic_milestone LEFT JOIN epic ON epic.id = epic_milestone.epic_id'

export function blankToNull(text: string | null): string | null {
  return text === null || text.trim() === '' ? null : text
}

export function toEvent(row: EventRow): ProjectEvent {
  return {
    id: row.id,
    type: row.kind,
    date: row.due_on,
    title: row.title,
    projectId: row.project_id,
    epicId: row.epic_id,
    note: row.note,
    minutes: row.minutes,
    minutesUpdatedAt: row.minutes_updated_at,
  }
}

export function prepareEventStatements(db: Database.Database) {
  return {
    selectOfProject: db.prepare<[number, string | null, string | null], EventRow>(
      `SELECT ${COLUMNS} ${FROM}
      WHERE COALESCE(epic_milestone.project_id, epic.project_id) = ?
        AND (epic.id IS NULL OR epic.deleted_at IS NULL)
        AND (? IS NULL OR epic_milestone.due_on >= ?)
      ORDER BY epic_milestone.due_on, epic_milestone.id`,
    ),
    selectOne: db.prepare<[number], EventRow>(`SELECT ${COLUMNS} ${FROM} WHERE epic_milestone.id = ?`),
    selectProject: db.prepare<[number], { id: number }>('SELECT id FROM project WHERE id = ?'),
    selectEpic: db.prepare<[number], { project_id: number; deleted_at: string | null }>(
      'SELECT project_id, deleted_at FROM epic WHERE id = ?',
    ),
    insert: db.prepare<[number | null, number, EventType, string, string, string | null, string | null, string | null]>(
      `INSERT INTO epic_milestone (epic_id, project_id, kind, due_on, title, note, minutes, minutes_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    remove: db.prepare<[number]>('DELETE FROM epic_milestone WHERE id = ?'),
    selectTwin: db.prepare<[number, EventType, string], { id: number }>(
      'SELECT id FROM epic_milestone WHERE epic_id = ? AND kind = ? AND due_on = ? ORDER BY id LIMIT 1',
    ),
  }
}
