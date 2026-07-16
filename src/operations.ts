import { resolvePort } from './ports.js'
import {
  addTaskItem,
  cleanupTask,
  createTask,
  escalateTask,
  getTask,
  getUsedPorts,
  setPid,
  setWorktreePath,
  toggleTaskItem,
  updateCheckpoint,
} from './db/tasks.js'
import { addWorktreeForBranch, removeWorktreeForBranch } from './git/worktree.js'
import { isProcessAlive, startServer, stopServer } from './process/runner.js'
import type { ITask, ITaskItem, TaskCheckpoint } from './types/task.js'

export interface IOpResult<T> {
  ok: boolean
  error?: string
  detail?: string
  data?: T
}

function fail(error: string, detail?: string): IOpResult<never> {
  return { ok: false, error, detail }
}

function portKey(project: string, branch: string): string {
  return `${project}::${branch}`
}

export interface ICreateInput {
  project: string
  branch: string
  repoPath?: string | null
  runCommand?: string | null
  feature?: string | null
  role?: string | null
}

export function createWorktree(input: ICreateInput): IOpResult<ITask> {
  const existing = getTask(input.project, input.branch)
  const port =
    existing !== null
      ? existing.port
      : resolvePort(portKey(input.project, input.branch), new Set(getUsedPorts()))
  const task = createTask({ ...input, port })
  return { ok: true, data: task }
}

export function launchWorktree(project: string, branch: string): IOpResult<ITask> {
  const task = getTask(project, branch)
  if (task === null) {
    return fail('not_found')
  }
  if (task.repoPath === null) {
    return fail('no_repo_path', 'repoPath manquant : renseigne-le a la creation')
  }
  const result = addWorktreeForBranch(task.repoPath, branch)
  if (result.created && result.path !== null) {
    setWorktreePath(project, branch, result.path)
  }
  return { ok: result.created, detail: result.detail, data: getTask(project, branch) ?? undefined }
}

export function startWorktreeServer(project: string, branch: string): IOpResult<ITask> {
  const task = getTask(project, branch)
  if (task === null) {
    return fail('not_found')
  }
  if (task.runCommand === null) {
    return fail('no_run_command', 'runCommand manquant : renseigne-le a la creation')
  }
  if (task.pid !== null && isProcessAlive(task.pid)) {
    return { ok: true, detail: `Deja lance (pid ${task.pid})`, data: task }
  }
  const cwd = task.worktreePath ?? task.repoPath
  const result = startServer(task.runCommand, task.port, cwd)
  setPid(project, branch, result.pid)
  return { ok: result.pid !== null, detail: result.detail, data: getTask(project, branch) ?? undefined }
}

export function stopWorktreeServer(project: string, branch: string): IOpResult<ITask> {
  const task = getTask(project, branch)
  if (task === null) {
    return fail('not_found')
  }
  if (task.pid === null) {
    return { ok: true, detail: 'Aucun serveur a arreter', data: task }
  }
  const result = stopServer(task.pid)
  if (result.stopped) {
    setPid(project, branch, null)
  }
  return { ok: result.stopped, detail: result.detail, data: getTask(project, branch) ?? undefined }
}

export interface ICleanupResult {
  serverStopped: boolean
  worktreeRemoved: boolean
  worktreePath: string | null
  rowDeleted: boolean
}

export function cleanupWorktree(project: string, branch: string): IOpResult<ICleanupResult> {
  const task = getTask(project, branch)
  let serverStopped = false
  if (task !== null && task.pid !== null && isProcessAlive(task.pid)) {
    serverStopped = stopServer(task.pid).stopped
  }
  const worktree = removeWorktreeForBranch(branch, task?.repoPath ?? null)
  const rowDeleted = cleanupTask(project, branch)
  return {
    ok: rowDeleted,
    detail: worktree.detail,
    data: {
      serverStopped,
      worktreeRemoved: worktree.removed,
      worktreePath: worktree.path,
      rowDeleted,
    },
  }
}

export function escalate(project: string, branch: string, reason: string): IOpResult<ITask> {
  const task = escalateTask(project, branch, reason)
  return task === null ? fail('not_found') : { ok: true, data: task }
}

export function checkpoint(
  project: string,
  branch: string,
  cp: TaskCheckpoint,
  contextSummary: string,
): IOpResult<ITask> {
  const task = updateCheckpoint(project, branch, cp, contextSummary)
  return task === null ? fail('not_found') : { ok: true, data: task }
}

export function addItem(project: string, branch: string, label: string): IOpResult<ITaskItem> {
  const item = addTaskItem(project, branch, label)
  return item === null ? fail('not_found') : { ok: true, data: item }
}

export function toggleItem(itemId: number, done: boolean): IOpResult<ITaskItem> {
  const item = toggleTaskItem(itemId, done)
  return item === null ? fail('not_found') : { ok: true, data: item }
}
