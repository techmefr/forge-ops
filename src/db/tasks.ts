import type Database from 'better-sqlite3'
import { getDb } from './connection.js'
import type { ITask, TaskCheckpoint, TaskStatus } from '../types/task.js'

interface ITaskRow {
  id: number
  branch: string
  port: number
  status: string
  last_checkpoint: string | null
  context_summary: string | null
  escalation_reason: string | null
  created_at: string
  updated_at: string
}

function rowToTask(row: ITaskRow): ITask {
  return {
    id: row.id,
    branch: row.branch,
    port: row.port,
    status: row.status as TaskStatus,
    lastCheckpoint: row.last_checkpoint as TaskCheckpoint | null,
    contextSummary: row.context_summary,
    escalationReason: row.escalation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function db(): Database.Database {
  return getDb()
}

export function createTask(branch: string, port: number): ITask {
  const stmt = db().prepare(
    `INSERT INTO tasks (branch, port) VALUES (@branch, @port)
     ON CONFLICT(branch) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
  )
  const row = stmt.get({ branch, port }) as ITaskRow
  return rowToTask(row)
}

export function getTaskByBranch(branch: string): ITask | null {
  const row = db().prepare('SELECT * FROM tasks WHERE branch = ?').get(branch) as
    | ITaskRow
    | undefined
  if (row === undefined) {
    return null
  }
  return rowToTask(row)
}

export function listTasks(status?: TaskStatus): ITask[] {
  const rows =
    status === undefined
      ? (db().prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all() as ITaskRow[])
      : (db()
          .prepare('SELECT * FROM tasks WHERE status = ? ORDER BY updated_at DESC')
          .all(status) as ITaskRow[])
  return rows.map(rowToTask)
}

export function getUsedPorts(): number[] {
  const rows = db().prepare('SELECT port FROM tasks').all() as { port: number }[]
  return rows.map((row) => row.port)
}

export function updateCheckpoint(
  branch: string,
  checkpoint: TaskCheckpoint,
  contextSummary: string,
): ITask | null {
  const isFinalCheckpoint = checkpoint === 'mr_draft_pushed'
  const nextStatus: TaskStatus = isFinalCheckpoint ? 'awaiting_human' : 'in_progress'
  db()
    .prepare(
      `UPDATE tasks
       SET last_checkpoint = @checkpoint,
           context_summary = @contextSummary,
           status = @status,
           updated_at = CURRENT_TIMESTAMP
       WHERE branch = @branch`,
    )
    .run({ branch, checkpoint, contextSummary, status: nextStatus })
  return getTaskByBranch(branch)
}

export function escalateTask(branch: string, reason: string): ITask | null {
  db()
    .prepare(
      `UPDATE tasks SET status = 'escalated', escalation_reason = @reason, updated_at = CURRENT_TIMESTAMP
       WHERE branch = @branch`,
    )
    .run({ branch, reason })
  return getTaskByBranch(branch)
}

export function cleanupTask(branch: string): boolean {
  const result = db().prepare('DELETE FROM tasks WHERE branch = ?').run(branch)
  return result.changes > 0
}
