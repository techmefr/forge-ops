import { existsSync } from 'node:fs'
import { isFresh } from './cache.js'
import { listTasks } from './db/tasks.js'
import { listArchNodes } from './db/arch.js'
import { lastEventFor } from './db/events.js'
import { discoverWorktrees } from './discover.js'
import type { IDiscoveredWorktree } from './discover.js'
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
export function plannedFor(
  feature: string | null,
  nodes: IArchNode[],
  alreadyWritten: Set<string>,
): string[] {
  return nodes
    .filter((node) => node.status !== 'done')
    .filter((node) => feature !== null && node.feature === feature)
    .map((node) => node.path)
    .filter((path) => !alreadyWritten.has(path))
    .sort()
}

function emptyFiles(): IWorktreeFiles {
  return { touched: [], inProgress: [], planned: [] }
}

/**
 * Une worktree decouverte et une tache enregistree designent la meme chose des
 * que le chemin coincide ; le couple projet/branche est le repli quand la tache
 * a ete creee sans que la worktree existe encore.
 */
export function matchTask(
  entry: IDiscoveredWorktree,
  tasks: ITask[],
): ITask | null {
  const byPath = tasks.find((task) => task.worktreePath === entry.worktreePath)
  if (byPath !== undefined) {
    return byPath
  }
  const byRepo = tasks.find(
    (task) => task.branch === entry.branch && task.repoPath === entry.repoPath,
  )
  if (byRepo !== undefined) {
    return byRepo
  }
  const byProject = tasks.find(
    (task) => task.branch === entry.branch && task.project === entry.project,
  )
  return byProject ?? null
}

interface IViewSource {
  project: string
  branch: string
  repoPath: string | null
  worktreePath: string | null
  head: string | null
  isMain: boolean
  task: ITask | null
}

function viewFor(
  source: IViewSource,
  archNodes: IArchNode[],
  now: number,
  baseCache: Map<string, string | null>,
): IWorktreeView {
  const task = source.task
  const lastActivity = lastEventFor(source.project, source.branch)
  const view: IWorktreeView = {
    project: source.project,
    branch: source.branch,
    isMain: source.isMain,
    tracked: task !== null,
    missing: false,
    port: task?.port ?? null,
    feature: task?.feature ?? null,
    role: task?.role ?? null,
    status: task?.status ?? 'created',
    lastCheckpoint: task?.lastCheckpoint ?? null,
    repoPath: source.repoPath,
    worktreePath: source.worktreePath,
    base: null,
    head: null,
    clean: true,
    files: emptyFiles(),
    lastActivity,
    idle: isIdle(lastActivity?.createdAt ?? null, now),
    detail: null,
  }

  const cwd = source.worktreePath ?? source.repoPath
  if (cwd === null || !existsSync(cwd)) {
    view.missing = true
    view.detail = 'worktree absente du disque'
    return view
  }

  // La base est une propriete du depot, pas de la worktree : la resoudre une
  // fois par depot evite une poignee de spawns git par worktree.
  const repoKey = source.repoPath ?? cwd
  if (!baseCache.has(repoKey)) {
    baseCache.set(repoKey, resolveBase(cwd))
  }
  const base = baseCache.get(repoKey) ?? null
  view.base = base
  view.head = source.head ?? headSha(cwd)
  const inProgress = dirtyFiles(cwd)
  const touched = base === null || base === source.branch ? [] : committedFiles(cwd, base, 'HEAD')
  if (base === null) {
    view.detail = 'aucune branche de base trouvee (develop/main/master)'
  }
  view.clean = inProgress.length === 0
  view.files = {
    touched,
    inProgress,
    planned: plannedFor(view.feature, archNodes, new Set([...touched, ...inProgress])),
  }
  return view
}

/**
 * La liste est celle du disque, pas celle de la base : starfleet montre les
 * worktrees qui existent, qu'elles aient ete creees par lui ou non. Les taches
 * enregistrees dont la worktree a disparu restent visibles, marquees absentes,
 * pour qu'on puisse les nettoyer plutot que les subir.
 */
const VIEW_CACHE_TTL_MS = 2000

let viewCache: { at: number; durationMs: number; value: IWorktreeView[] } | null = null

export function clearViewCache(): void {
  viewCache = null
}

/**
 * Un rafraichissement recalcule l'etat git de chaque worktree ; sans ce cache
 * court, trois endpoints ouverts en meme temps le refont trois fois.
 */
export function listWorktreeViews(project?: string): IWorktreeView[] {
  const now = Date.now()
  if (isFresh(viewCache, now, VIEW_CACHE_TTL_MS)) {
    const cached = viewCache as { value: IWorktreeView[] }
    return project === undefined
      ? cached.value
      : cached.value.filter((view) => view.project === project)
  }
  const value = computeWorktreeViews(now)
  // Horodate la fin du calcul, pas son debut : sinon la fenetre de fraicheur est
  // deja entamee — voire epuisee — au moment ou le cache devient lisible.
  const finishedAt = Date.now()
  viewCache = { at: finishedAt, durationMs: finishedAt - now, value }
  return project === undefined ? value : value.filter((view) => view.project === project)
}

function computeWorktreeViews(now: number): IWorktreeView[] {
  const tasks = listTasks()
  const archNodes = listArchNodes()
  const nodesOf = (name: string): IArchNode[] =>
    archNodes.filter((node) => node.project === name)

  const claimed = new Set<number>()
  const sources: IViewSource[] = []

  for (const entry of discoverWorktrees()) {
    if (entry.branch === null) {
      continue
    }
    const task = matchTask(entry, tasks)
    if (task !== null) {
      claimed.add(task.id)
    }
    sources.push({
      project: task?.project ?? entry.project,
      branch: entry.branch,
      repoPath: entry.repoPath,
      worktreePath: entry.worktreePath,
      head: entry.head,
      isMain: entry.isMain,
      task,
    })
  }

  for (const task of tasks) {
    if (claimed.has(task.id)) {
      continue
    }
    sources.push({
      project: task.project,
      branch: task.branch,
      repoPath: task.repoPath,
      worktreePath: task.worktreePath,
      head: null,
      isMain: false,
      task,
    })
  }

  const baseCache = new Map<string, string | null>()
  return sources.map((source) => viewFor(source, nodesOf(source.project), now, baseCache))
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
