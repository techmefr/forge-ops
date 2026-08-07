import type Database from 'better-sqlite3'
import { getDb } from './connection.js'
import type { IActivityEvent } from '../types/task.js'

const DEFAULT_LIMIT = 100

interface IActivityEventRow {
  id: number
  project: string | null
  branch: string | null
  worktree_path: string | null
  session: string | null
  tool: string
  file_path: string | null
  created_at: string
}

function rowToEvent(row: IActivityEventRow): IActivityEvent {
  return {
    id: row.id,
    project: row.project,
    branch: row.branch,
    worktreePath: row.worktree_path,
    session: row.session,
    tool: row.tool,
    filePath: row.file_path,
    createdAt: row.created_at,
  }
}

function db(): Database.Database {
  return getDb()
}

export interface IRecordEventInput {
  project?: string | null
  branch?: string | null
  worktreePath?: string | null
  session?: string | null
  tool: string
  filePath?: string | null
}

/**
 * Le hook ne connait que son cwd : quand project/branch manquent, on les retrouve
 * par le chemin de worktree enregistre a la creation.
 */
function resolveOwner(worktreePath: string | null): { project: string; branch: string } | null {
  if (worktreePath === null) {
    return null
  }
  const row = db()
    .prepare('SELECT project, branch FROM tasks WHERE worktree_path = ?')
    .get(worktreePath) as { project: string; branch: string } | undefined
  return row ?? null
}

export function recordEvent(input: IRecordEventInput): IActivityEvent {
  const worktreePath = input.worktreePath ?? null
  const owner =
    input.project != null && input.branch != null
      ? { project: input.project, branch: input.branch }
      : resolveOwner(worktreePath)
  const row = db()
    .prepare(
      `INSERT INTO activity_events (project, branch, worktree_path, session, tool, file_path)
       VALUES (@project, @branch, @worktreePath, @session, @tool, @filePath)
       RETURNING *`,
    )
    .get({
      project: owner?.project ?? null,
      branch: owner?.branch ?? null,
      worktreePath,
      session: input.session ?? null,
      tool: input.tool,
      filePath: input.filePath ?? null,
    }) as IActivityEventRow
  return rowToEvent(row)
}

export function listEvents(limit = DEFAULT_LIMIT): IActivityEvent[] {
  const rows = db()
    .prepare('SELECT * FROM activity_events ORDER BY id DESC LIMIT ?')
    .all(limit) as IActivityEventRow[]
  return rows.map(rowToEvent)
}

export function listEventsFor(project: string, branch: string, limit = DEFAULT_LIMIT): IActivityEvent[] {
  const rows = db()
    .prepare(
      'SELECT * FROM activity_events WHERE project = ? AND branch = ? ORDER BY id DESC LIMIT ?',
    )
    .all(project, branch, limit) as IActivityEventRow[]
  return rows.map(rowToEvent)
}

export function lastEventFor(project: string, branch: string): IActivityEvent | null {
  const row = db()
    .prepare(
      'SELECT * FROM activity_events WHERE project = ? AND branch = ? ORDER BY id DESC LIMIT 1',
    )
    .get(project, branch) as IActivityEventRow | undefined
  return row === undefined ? null : rowToEvent(row)
}

export function pruneEvents(keep: number): number {
  const result = db()
    .prepare(
      `DELETE FROM activity_events
       WHERE id NOT IN (SELECT id FROM activity_events ORDER BY id DESC LIMIT ?)`,
    )
    .run(keep)
  return result.changes
}
