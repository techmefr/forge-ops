import type Database from 'better-sqlite3'
import { getDb } from './connection.js'
import type { ITask, TaskCheckpoint, TaskStatus } from '../types/task.js'

export const ATTEMPT_CAP = 5
export const ACTION_CAP = 50
export const DEFAULT_STALE_MINUTES = 15

interface ITaskRow {
  id: number
  branch: string
  port: number
  status: string
  last_checkpoint: string | null
  heartbeat: string | null
  context_summary: string | null
  attempt_count: number
  action_count: number
  last_error_hash: string | null
  recommended_model: string | null
  current_model: string | null
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
    heartbeat: row.heartbeat,
    contextSummary: row.context_summary,
    attemptCount: row.attempt_count,
    actionCount: row.action_count,
    lastErrorHash: row.last_error_hash,
    recommendedModel: row.recommended_model,
    currentModel: row.current_model,
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
     ON CONFLICT(branch) DO UPDATE SET port = excluded.port
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

export function touchHeartbeat(branch: string): void {
  db()
    .prepare(
      `UPDATE tasks SET heartbeat = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE branch = ?`,
    )
    .run(branch)
}

export function updateCheckpoint(
  branch: string,
  checkpoint: TaskCheckpoint,
  contextSummary: string,
): ITask | null {
  const isFinalCheckpoint = checkpoint === 'mr_draft_pushed'
  const nextStatus: TaskStatus = isFinalCheckpoint ? 'awaiting_human' : 'testing'
  db()
    .prepare(
      `UPDATE tasks
       SET last_checkpoint = @checkpoint,
           context_summary = @contextSummary,
           status = @status,
           heartbeat = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE branch = @branch`,
    )
    .run({ branch, checkpoint, contextSummary, status: nextStatus })
  return getTaskByBranch(branch)
}

export interface IAttemptResult {
  task: ITask
  capExceeded: boolean
}

export function incrementAttempt(branch: string): IAttemptResult {
  db()
    .prepare(
      `UPDATE tasks SET attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE branch = ?`,
    )
    .run(branch)
  const taskAfterIncrement = getTaskByBranch(branch)
  if (taskAfterIncrement === null) {
    throw new Error(`Task introuvable pour la branche ${branch}`)
  }
  const capExceeded = taskAfterIncrement.attemptCount >= ATTEMPT_CAP
  const task = capExceeded ? escalateTask(branch, 'attempt_cap_exceeded') : taskAfterIncrement
  if (task === null) {
    throw new Error(`Task introuvable pour la branche ${branch}`)
  }
  return { task, capExceeded }
}

export function incrementAction(branch: string): IAttemptResult {
  db()
    .prepare(
      `UPDATE tasks SET action_count = action_count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE branch = ?`,
    )
    .run(branch)
  const taskAfterIncrement = getTaskByBranch(branch)
  if (taskAfterIncrement === null) {
    throw new Error(`Task introuvable pour la branche ${branch}`)
  }
  const capExceeded = taskAfterIncrement.actionCount >= ACTION_CAP
  const task = capExceeded ? escalateTask(branch, 'action_limit_exceeded') : taskAfterIncrement
  if (task === null) {
    throw new Error(`Task introuvable pour la branche ${branch}`)
  }
  return { task, capExceeded }
}

export interface IErrorCheckResult {
  isRepeatedLoop: boolean
  task: ITask
}

export function recordError(branch: string, errorHash: string): IErrorCheckResult {
  const before = getTaskByBranch(branch)
  if (before === null) {
    throw new Error(`Task introuvable pour la branche ${branch}`)
  }
  const isRepeatedLoop = before.lastErrorHash !== null && before.lastErrorHash === errorHash
  db()
    .prepare(
      `UPDATE tasks SET last_error_hash = @errorHash, status = 'failed', updated_at = CURRENT_TIMESTAMP
       WHERE branch = @branch`,
    )
    .run({ branch, errorHash })
  if (isRepeatedLoop) {
    escalateTask(branch, 'repeated_error_loop')
  }
  const task = getTaskByBranch(branch)
  if (task === null) {
    throw new Error(`Task introuvable pour la branche ${branch}`)
  }
  return { isRepeatedLoop, task }
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

export function setModelInfo(
  branch: string,
  recommendedModel: string,
  currentModel: string | null,
): ITask | null {
  db()
    .prepare(
      `UPDATE tasks SET recommended_model = @recommendedModel, current_model = @currentModel, updated_at = CURRENT_TIMESTAMP
       WHERE branch = @branch`,
    )
    .run({ branch, recommendedModel, currentModel })
  return getTaskByBranch(branch)
}

export function findStaleTasks(staleMinutes: number = DEFAULT_STALE_MINUTES): ITask[] {
  const rows = db()
    .prepare(
      `SELECT * FROM tasks
       WHERE status NOT IN ('done', 'escalated')
       AND (heartbeat IS NULL OR heartbeat <= datetime('now', @offset))
       ORDER BY updated_at ASC`,
    )
    .all({ offset: `-${staleMinutes} minutes` }) as ITaskRow[]
  return rows.map(rowToTask)
}
