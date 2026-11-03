import type Database from 'better-sqlite3'
import type { EventDraft, EventPatch, ProjectEvent } from '../../../../contract/EventContract.js'
import { createEventGuards } from './EventGuards.js'
import { blankToNull, prepareEventStatements, toEvent } from './EventStatements.js'

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

const columnsOfPatch = {
  type: 'kind',
  date: 'due_on',
  title: 'title',
  epicId: 'epic_id',
  note: 'note',
} as const

type EventAssignments = { assignments: string[]; values: (string | number | null)[] }

function assignmentsOfPatch(patch: EventPatch, current: ProjectEvent, now: () => string): EventAssignments {
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
  return { assignments, values }
}

export function createEventRepository(
  db: Database.Database,
  { now = () => new Date().toISOString() }: EventRepositoryOptions = {},
): EventRepository {
  const statements = prepareEventStatements(db)
  const { selectOfProject, insert, remove, selectTwin } = statements
  const { assertProject, assertEpicInProject, find } = createEventGuards(statements)

  const write = db.transaction((eventId: number, patch: EventPatch): ProjectEvent => {
    const current = find(eventId)
    if (patch.epicId !== undefined && patch.epicId !== null) {
      assertEpicInProject(patch.epicId, current.projectId)
    }
    const { assignments, values } = assignmentsOfPatch(patch, current, now)
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
      const twin = draft.epicId === null ? undefined : selectTwin.get(draft.epicId, draft.type, draft.date)
      if (twin !== undefined) {
        return find(twin.id)
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
