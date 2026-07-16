import { getDb } from './connection.js'
import type { ArchStatus, IArchNode } from '../types/task.js'

interface IArchRow {
  id: number
  project: string
  path: string
  purpose: string | null
  status: string
  feature: string | null
  created_at: string
  updated_at: string
}

function rowToNode(row: IArchRow): IArchNode {
  return {
    id: row.id,
    project: row.project,
    path: row.path,
    purpose: row.purpose,
    status: row.status as ArchStatus,
    feature: row.feature,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface ISetArchInput {
  project: string
  path: string
  purpose?: string | null
  status?: ArchStatus | null
  feature?: string | null
}

export function setArchNode(input: ISetArchInput): IArchNode {
  const row = getDb()
    .prepare(
      `INSERT INTO arch_nodes (project, path, purpose, status, feature)
       VALUES (@project, @path, @purpose, coalesce(@status, 'planned'), @feature)
       ON CONFLICT(project, path) DO UPDATE SET
         purpose = coalesce(excluded.purpose, purpose),
         status = coalesce(excluded.status, status),
         feature = coalesce(excluded.feature, feature),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
    )
    .get({
      project: input.project,
      path: input.path,
      purpose: input.purpose ?? null,
      status: input.status ?? null,
      feature: input.feature ?? null,
    }) as IArchRow
  return rowToNode(row)
}

export function listArchNodes(project?: string): IArchNode[] {
  const rows =
    project === undefined
      ? (getDb().prepare('SELECT * FROM arch_nodes ORDER BY project, path').all() as IArchRow[])
      : (getDb()
          .prepare('SELECT * FROM arch_nodes WHERE project = ? ORDER BY path')
          .all(project) as IArchRow[])
  return rows.map(rowToNode)
}

// Passe en done tous les noeuds d'archi livres par une feature (appele au merge).
export function markArchFeatureDone(feature: string): void {
  getDb()
    .prepare(
      `UPDATE arch_nodes SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE feature = ?`,
    )
    .run(feature)
}
