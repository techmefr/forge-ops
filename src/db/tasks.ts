import type Database from 'better-sqlite3'
import { getDb } from './connection.js'
import type { ITask, ITaskItem, TaskCheckpoint, TaskStatus } from '../types/task.js'

interface ITaskRow {
  id: number
  project: string
  branch: string
  port: number
  repo_path: string | null
  worktree_path: string | null
  run_command: string | null
  pid: number | null
  feature: string | null
  status: string
  last_checkpoint: string | null
  context_summary: string | null
  escalation_reason: string | null
  created_at: string
  updated_at: string
}

interface ITaskItemRow {
  id: number
  task_id: number
  label: string
  done: number
  created_at: string
}

function rowToTask(row: ITaskRow): ITask {
  return {
    id: row.id,
    project: row.project,
    branch: row.branch,
    port: row.port,
    repoPath: row.repo_path,
    worktreePath: row.worktree_path,
    runCommand: row.run_command,
    pid: row.pid,
    feature: row.feature,
    status: row.status as TaskStatus,
    lastCheckpoint: row.last_checkpoint as TaskCheckpoint | null,
    contextSummary: row.context_summary,
    escalationReason: row.escalation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToItem(row: ITaskItemRow): ITaskItem {
  return {
    id: row.id,
    taskId: row.task_id,
    label: row.label,
    done: row.done === 1,
    createdAt: row.created_at,
  }
}

function db(): Database.Database {
  return getDb()
}

export interface ICreateTaskInput {
  project: string
  branch: string
  port: number
  repoPath?: string | null
  runCommand?: string | null
  feature?: string | null
}

export function createTask(input: ICreateTaskInput): ITask {
  const row = db()
    .prepare(
      `INSERT INTO tasks (project, branch, port, repo_path, run_command, feature)
       VALUES (@project, @branch, @port, @repoPath, @runCommand, @feature)
       ON CONFLICT(project, branch) DO UPDATE SET
         repo_path = coalesce(excluded.repo_path, repo_path),
         run_command = coalesce(excluded.run_command, run_command),
         feature = coalesce(excluded.feature, feature),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
    )
    .get({
      project: input.project,
      branch: input.branch,
      port: input.port,
      repoPath: input.repoPath ?? null,
      runCommand: input.runCommand ?? null,
      feature: input.feature ?? null,
    }) as ITaskRow
  return rowToTask(row)
}

export function getTask(project: string, branch: string): ITask | null {
  const row = db()
    .prepare('SELECT * FROM tasks WHERE project = ? AND branch = ?')
    .get(project, branch) as ITaskRow | undefined
  return row === undefined ? null : rowToTask(row)
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
  project: string,
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
       WHERE project = @project AND branch = @branch`,
    )
    .run({ project, branch, checkpoint, contextSummary, status: nextStatus })
  return getTask(project, branch)
}

export function setWorktreePath(project: string, branch: string, worktreePath: string | null): void {
  db()
    .prepare(
      `UPDATE tasks SET worktree_path = @worktreePath, updated_at = CURRENT_TIMESTAMP
       WHERE project = @project AND branch = @branch`,
    )
    .run({ project, branch, worktreePath })
}

export function setPid(project: string, branch: string, pid: number | null): void {
  db()
    .prepare(
      `UPDATE tasks SET pid = @pid, updated_at = CURRENT_TIMESTAMP
       WHERE project = @project AND branch = @branch`,
    )
    .run({ project, branch, pid })
}

export function escalateTask(project: string, branch: string, reason: string): ITask | null {
  db()
    .prepare(
      `UPDATE tasks SET status = 'escalated', escalation_reason = @reason, updated_at = CURRENT_TIMESTAMP
       WHERE project = @project AND branch = @branch`,
    )
    .run({ project, branch, reason })
  return getTask(project, branch)
}

export function cleanupTask(project: string, branch: string): boolean {
  const result = db()
    .prepare('DELETE FROM tasks WHERE project = ? AND branch = ?')
    .run(project, branch)
  return result.changes > 0
}

export function addTaskItem(project: string, branch: string, label: string): ITaskItem | null {
  const task = getTask(project, branch)
  if (task === null) {
    return null
  }
  const row = db()
    .prepare('INSERT INTO task_items (task_id, label) VALUES (?, ?) RETURNING *')
    .get(task.id, label) as ITaskItemRow
  return rowToItem(row)
}

export function toggleTaskItem(itemId: number, done: boolean): ITaskItem | null {
  const row = db()
    .prepare('UPDATE task_items SET done = ? WHERE id = ? RETURNING *')
    .get(done ? 1 : 0, itemId) as ITaskItemRow | undefined
  return row === undefined ? null : rowToItem(row)
}

export function listTaskItems(taskId: number): ITaskItem[] {
  const rows = db()
    .prepare('SELECT * FROM task_items WHERE task_id = ? ORDER BY id ASC')
    .all(taskId) as ITaskItemRow[]
  return rows.map(rowToItem)
}
