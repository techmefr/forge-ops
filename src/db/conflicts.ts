import type Database from 'better-sqlite3'
import { getDb } from './connection.js'
import type { IConflict } from '../types/task.js'

interface IConflictRow {
  id: number
  project: string
  left_branch: string
  right_branch: string
  file_path: string
  promoted: number
  arbitration: string | null
  first_seen_at: string
  last_seen_at: string
  resolved_at: string | null
}

function rowToConflict(row: IConflictRow): IConflict {
  return {
    id: row.id,
    project: row.project,
    leftBranch: row.left_branch,
    rightBranch: row.right_branch,
    filePath: row.file_path,
    promoted: row.promoted === 1,
    arbitration: row.arbitration,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at,
  }
}

function db(): Database.Database {
  return getDb()
}

export interface IUpsertConflictInput {
  project: string
  leftBranch: string
  rightBranch: string
  filePath: string
  promoted: boolean
  arbitration: string | null
}

export function upsertConflict(input: IUpsertConflictInput): IConflict {
  const row = db()
    .prepare(
      `INSERT INTO conflicts (project, left_branch, right_branch, file_path, promoted, arbitration)
       VALUES (@project, @leftBranch, @rightBranch, @filePath, @promoted, @arbitration)
       ON CONFLICT(project, left_branch, right_branch, file_path) DO UPDATE SET
         promoted = excluded.promoted,
         arbitration = excluded.arbitration,
         last_seen_at = CURRENT_TIMESTAMP,
         resolved_at = NULL
       RETURNING *`,
    )
    .get({
      project: input.project,
      leftBranch: input.leftBranch,
      rightBranch: input.rightBranch,
      filePath: input.filePath,
      promoted: input.promoted ? 1 : 0,
      arbitration: input.arbitration,
    }) as IConflictRow
  return rowToConflict(row)
}

/**
 * Auto-fermeture : tout conflit ouvert du projet qui n'a pas ete revu par ce scan
 * n'existe plus, sinon le tableau se remplit de fantomes et se fait ignorer.
 */
export function resolveMissingConflicts(project: string, seenIds: number[]): number {
  const placeholders = seenIds.map(() => '?').join(',')
  const clause = seenIds.length === 0 ? '' : ` AND id NOT IN (${placeholders})`
  const result = db()
    .prepare(
      `UPDATE conflicts SET resolved_at = CURRENT_TIMESTAMP
       WHERE project = ? AND resolved_at IS NULL${clause}`,
    )
    .run(project, ...seenIds)
  return result.changes
}

export function listOpenConflicts(project?: string): IConflict[] {
  const rows =
    project === undefined
      ? (db()
          .prepare(
            'SELECT * FROM conflicts WHERE resolved_at IS NULL ORDER BY promoted DESC, project, file_path',
          )
          .all() as IConflictRow[])
      : (db()
          .prepare(
            `SELECT * FROM conflicts WHERE resolved_at IS NULL AND project = ?
             ORDER BY promoted DESC, file_path`,
          )
          .all(project) as IConflictRow[])
  return rows.map(rowToConflict)
}
