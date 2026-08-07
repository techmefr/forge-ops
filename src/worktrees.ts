import { existsSync } from 'node:fs'
import { listTasks } from './db/tasks.js'
import { listArchNodes } from './db/arch.js'
import { lastEventFor } from './db/events.js'
import { committedFiles, dirtyFiles, headSha, resolveBase, runGit } from './git/inspect.js'
import type {
  IArchNode,
  IFileRow,
  ITask,
  IWorktreeFiles,
  IWorktreeView,
} from './types/task.js'

const IDLE_AFTER_MS = 5 * 60 * 1000

export function isIdle(lastActivityAt: string | null, now: number): boolean {
  if (lastActivityAt === null) {
    return true
  }
  return now - new Date(`${lastActivityAt}Z`).getTime() > IDLE_AFTER_MS
}

/**
 * Le prevu ne sort pas de git : c'est l'intention declaree par l'etape archi du
 * pipeline, rattachee a la worktree par sa feature. Un noeud deja livre par la
 * branche sort du prevu, il est devenu du touche.
 */
export function plannedFor(task: ITask, nodes: IArchNode[], alreadyWritten: Set<string>): string[] {
  return nodes
    .filter((node) => node.status !== 'done')
    .filter((node) => task.feature !== null && node.feature === task.feature)
    .map((node) => node.path)
    .filter((path) => !alreadyWritten.has(path))
    .sort()
}

function emptyFiles(): IWorktreeFiles {
  return { touched: [], inProgress: [], planned: [] }
}

function viewFor(task: ITask, archNodes: IArchNode[], now: number): IWorktreeView {
  const lastActivity = lastEventFor(task.project, task.branch)
  const view: IWorktreeView = {
    project: task.project,
    branch: task.branch,
    feature: task.feature,
    role: task.role,
    status: task.status,
    lastCheckpoint: task.lastCheckpoint,
    repoPath: task.repoPath,
    worktreePath: task.worktreePath,
    base: null,
    head: null,
    clean: true,
    files: emptyFiles(),
    lastActivity,
    idle: isIdle(lastActivity?.createdAt ?? null, now),
    detail: null,
  }

  const cwd = task.worktreePath ?? task.repoPath
  if (cwd === null || !existsSync(cwd)) {
    view.detail = 'worktree absente du disque : rien a inspecter'
    return view
  }

  const base = resolveBase(cwd)
  view.base = base
  view.head = headSha(cwd)
  const inProgress = dirtyFiles(cwd)
  const head = runGit(cwd, ['rev-parse', '--verify', '--quiet', task.branch]).ok
    ? task.branch
    : 'HEAD'
  const touched = base === null ? [] : committedFiles(cwd, base, head)
  if (base === null) {
    view.detail = 'aucune branche de base trouvee (develop/main/master)'
  }
  view.clean = inProgress.length === 0
  view.files = {
    touched,
    inProgress,
    planned: plannedFor(task, archNodes, new Set([...touched, ...inProgress])),
  }
  return view
}

export function listWorktreeViews(project?: string): IWorktreeView[] {
  const now = Date.now()
  const tasks = listTasks().filter((task) => project === undefined || task.project === project)
  const archNodes = listArchNodes(project)
  return tasks.map((task) =>
    viewFor(
      task,
      archNodes.filter((node) => node.project === task.project),
      now,
    ),
  )
}

/**
 * La table par fichier : qui l'ecrit, depuis quelle branche, et a quel niveau de
 * certitude. Les trois niveaux ne sont jamais fondus dans une seule colonne, un
 * fichier prevu et un fichier deja ecrit ne se lisent pas pareil.
 */
export function buildFileMap(views: IWorktreeView[]): IFileRow[] {
  const rows = new Map<string, IFileRow>()
  const add = (view: IWorktreeView, path: string, state: IFileRow['owners'][number]['state']): void => {
    const key = `${view.project}::${path}`
    let row = rows.get(key)
    if (row === undefined) {
      row = { project: view.project, path, owners: [], shared: false }
      rows.set(key, row)
    }
    const existing = row.owners.find((owner) => owner.branch === view.branch)
    if (existing === undefined) {
      row.owners.push({ branch: view.branch, worktreePath: view.worktreePath, state })
      return
    }
    if (state === 'in_progress' || (state === 'touched' && existing.state === 'planned')) {
      existing.state = state
    }
  }

  for (const view of views) {
    for (const path of view.files.touched) {
      add(view, path, 'touched')
    }
    for (const path of view.files.inProgress) {
      add(view, path, 'in_progress')
    }
    for (const path of view.files.planned) {
      add(view, path, 'planned')
    }
  }

  const all = [...rows.values()]
  for (const row of all) {
    row.owners.sort((left, right) => left.branch.localeCompare(right.branch))
    row.shared = row.owners.length > 1
  }
  return all.sort((left, right) => {
    if (left.shared !== right.shared) {
      return left.shared ? -1 : 1
    }
    return `${left.project}/${left.path}`.localeCompare(`${right.project}/${right.path}`)
  })
}
