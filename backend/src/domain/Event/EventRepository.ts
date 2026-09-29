import type Database from 'better-sqlite3'
import type { EventDraft, EventPatch, EventType, ProjectEvent } from '../../../../contract/EventContract.js'
import { EpicNotFoundError, ProjectNotFoundError } from '../Story/StoryViolation.js'
import { EventEpicOutsideProjectError, EventNotFoundError } from './EventViolation.js'

export type EventWindow = {
  from?: string
  to?: string
}

export type EventRepository = {
  listOfProject: (projectId: number, window?: EventWindow) => readonly ProjectEvent[]
  find: (eventId: number) => ProjectEvent
  create: (draft: EventDraft) => ProjectEvent
  update: (eventId: number, patch: EventPatch) => ProjectEvent
  remove: (eventId: number) => void
}

export type EventRepositoryOptions = {
  now?: () => string
}

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

const COLUMNS = `epic_milestone.id AS id, epic_milestone.kind AS kind, epic_milestone.due_on AS due_on,
       epic_milestone.title AS title,
       COALESCE(epic_milestone.project_id, epic.project_id) AS project_id,
       epic_milestone.epic_id AS epic_id, epic_milestone.note AS note,
       epic_milestone.minutes AS minutes, epic_milestone.minutes_updated_at AS minutes_updated_at`

const FROM = 'FROM epic_milestone LEFT JOIN epic ON epic.id = epic_milestone.epic_id'

function blankToNull(text: string | null): string | null {
  return text === null || text.trim() === '' ? null : text
}

function toEvent(row: EventRow): ProjectEvent {
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

export function createEventRepository(
  db: Database.Database,
  { now = () => new Date().toISOString() }: EventRepositoryOptions = {},
): EventRepository {
  const selectOfProject = db.prepare<[number, string | null, string | null], EventRow>(
    `SELECT ${COLUMNS} ${FROM}
      WHERE COALESCE(epic_milestone.project_id, epic.project_id) = ?
        AND (? IS NULL OR epic_milestone.due_on >= ?)
      ORDER BY epic_milestone.due_on, epic_milestone.id`,
  )
  const selectOne = db.prepare<[number], EventRow>(`SELECT ${COLUMNS} ${FROM} WHERE epic_milestone.id = ?`)
  const selectProject = db.prepare<[number], { id: number }>('SELECT id FROM project WHERE id = ?')
  const selectEpic = db.prepare<[number], { project_id: number; deleted_at: string | null }>(
    'SELECT project_id, deleted_at FROM epic WHERE id = ?',
  )
  const insert = db.prepare<[number | null, number, EventType, string, string, string | null, string | null, string | null]>(
    `INSERT INTO epic_milestone (epic_id, project_id, kind, due_on, title, note, minutes, minutes_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const remove = db.prepare<[number]>('DELETE FROM epic_milestone WHERE id = ?')

  function assertProject(projectId: number): void {
    if (selectProject.get(projectId) === undefined) {
      throw new ProjectNotFoundError(projectId)
    }
  }

  function assertEpicInProject(epicId: number, projectId: number): void {
    const epic = selectEpic.get(epicId)
    if (epic === undefined || epic.deleted_at !== null) {
      throw new EpicNotFoundError(epicId)
    }
    if (epic.project_id !== projectId) {
      throw new EventEpicOutsideProjectError(epicId, projectId)
    }
  }

  function find(eventId: number): ProjectEvent {
    const row = selectOne.get(eventId)
    if (row === undefined) {
      throw new EventNotFoundError(eventId)
    }
    return toEvent(row)
  }

  const columnsOfPatch = {
    type: 'kind',
    date: 'due_on',
    title: 'title',
    epicId: 'epic_id',
    note: 'note',
  } as const

  const write = db.transaction((eventId: number, patch: EventPatch): ProjectEvent => {
    const current = find(eventId)
    if (patch.epicId !== undefined && patch.epicId !== null) {
      assertEpicInProject(patch.epicId, current.projectId)
    }
    const assignments: string[] = []
    const values: (string | number | null)[] = []
    for (const [key, column] of Object.entries(columnsOfPatch)) {
      const value = patch[key as keyof typeof columnsOfPatch]
      if (value !== undefined) {
        assignments.push(`${column} = ?`)
        values.push(value)
      }
    }
    if (patch.minutes !== undefined) {
      const minutes = blankToNull(patch.minutes)
      if (minutes !== current.minutes) {
        assignments.push('minutes = ?', 'minutes_updated_at = ?')
        values.push(minutes, minutes === null ? null : now())
      }
    }
    if (assignments.length > 0) {
      db.prepare(`UPDATE epic_milestone SET ${assignments.join(', ')} WHERE id = ?`).run(...values, eventId)
    }
    return find(eventId)
  })

  return {
    listOfProject: (projectId, { from, to } = {}) => {
      assertProject(projectId)
      return selectOfProject
        .all(projectId, from ?? null, from ?? null)
        .filter((row) => to === undefined || row.due_on <= to)
        .map(toEvent)
    },

    find,

    create: (draft) => {
      assertProject(draft.projectId)
      if (draft.epicId !== null) {
        assertEpicInProject(draft.epicId, draft.projectId)
      }
      const minutes = blankToNull(draft.minutes)
      const info = insert.run(
        draft.epicId,
        draft.projectId,
        draft.type,
        draft.date,
        draft.title,
        draft.note,
        minutes,
        minutes === null ? null : now(),
      )
      return find(Number(info.lastInsertRowid))
    },

    update: (eventId, patch) => write(eventId, patch),

    remove: (eventId) => {
      find(eventId)
      remove.run(eventId)
    },
  }
}
