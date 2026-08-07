import { existsSync } from 'node:fs'
import { listOpenConflicts, resolveMissingConflicts, upsertConflict } from './db/conflicts.js'
import { checkMergeConflict, dirtyCommit } from './git/inspect.js'
import { listWorktreeViews } from './worktrees.js'
import type { IConflict, IWorktreeView, TaskCheckpoint, TaskStatus } from './types/task.js'

/**
 * Checkpoints a partir desquels le code d'un cote a arrete de bouger. Avant ca,
 * un conflit est du bruit : les deux cotes ecrivent encore.
 */
const FROZEN_CHECKPOINTS: TaskCheckpoint[] = [
  'build_done',
  'reviewed',
  'simplified',
  'mr_draft_pushed',
]

export interface ISide {
  branch: string
  status: TaskStatus
  lastCheckpoint: TaskCheckpoint | null
}

export function isFrozen(side: ISide): boolean {
  return side.lastCheckpoint !== null && FROZEN_CHECKPOINTS.includes(side.lastCheckpoint)
}

export function isInHumanReview(side: ISide): boolean {
  return side.status === 'awaiting_human' || side.lastCheckpoint === 'mr_draft_pushed'
}

/**
 * Regle par defaut : le cote qui n'est pas encore en relecture humaine bouge.
 * Quand les deux le sont, ou aucun, starfleet ne tranche pas — c'est le dev.
 */
export function decideArbitration(left: ISide, right: ISide): string | null {
  const leftReviewed = isInHumanReview(left)
  const rightReviewed = isInHumanReview(right)
  if (leftReviewed === rightReviewed) {
    return null
  }
  return leftReviewed ? right.branch : left.branch
}

export function orderPair<T extends { branch: string }>(left: T, right: T): [T, T] {
  return left.branch.localeCompare(right.branch) <= 0 ? [left, right] : [right, left]
}

/**
 * Reference a comparer pour une worktree : l'etat sale quand il y en a un (commit
 * ecrit par `git stash create`, sans toucher au working tree ni a la pile de
 * stash), sinon la branche.
 */
function comparableRef(view: IWorktreeView, cache: Map<string, string>): string {
  const path = view.worktreePath
  if (path === null || !existsSync(path)) {
    return view.branch
  }
  const cached = cache.get(path)
  if (cached !== undefined) {
    return cached
  }
  const ref = dirtyCommit(path) ?? view.branch
  cache.set(path, ref)
  return ref
}

export interface IConflictScan {
  project: string
  pairsChecked: number
  conflicts: IConflict[]
  resolved: number
  errors: string[]
}

function scanRepo(
  project: string,
  repoPath: string,
  views: IWorktreeView[],
  refCache: Map<string, string>,
  scan: IConflictScan,
  seenIds: number[],
): void {
  for (let i = 0; i < views.length; i += 1) {
    for (let j = i + 1; j < views.length; j += 1) {
      const [left, right] = orderPair(views[i] as IWorktreeView, views[j] as IWorktreeView)
      if (left.branch === right.branch) {
        continue
      }
      const check = checkMergeConflict(
        repoPath,
        comparableRef(left, refCache),
        comparableRef(right, refCache),
      )
      scan.pairsChecked += 1
      if (!check.ok) {
        scan.errors.push(`${left.branch} / ${right.branch}: ${check.detail}`)
        continue
      }
      const promoted = isFrozen(left) || isFrozen(right)
      const arbitration = decideArbitration(left, right)
      for (const filePath of check.files) {
        const conflict = upsertConflict({
          project,
          leftBranch: left.branch,
          rightBranch: right.branch,
          filePath,
          promoted,
          arbitration,
        })
        seenIds.push(conflict.id)
        scan.conflicts.push(conflict)
      }
    }
  }
}

/**
 * Les conflits se cherchent entre worktrees du meme depot : deux branches de
 * projets differents ne peuvent pas se marcher dessus, et une worktree absente
 * du disque n'a rien a comparer.
 */
export function scanConflicts(project?: string): IConflictScan[] {
  const views = listWorktreeViews(project).filter(
    (view) => !view.missing && view.repoPath !== null,
  )

  const byProject = new Map<string, IWorktreeView[]>()
  for (const view of views) {
    const bucket = byProject.get(view.project) ?? []
    bucket.push(view)
    byProject.set(view.project, bucket)
  }

  const scans: IConflictScan[] = []
  for (const [name, projectViews] of byProject) {
    const scan: IConflictScan = {
      project: name,
      pairsChecked: 0,
      conflicts: [],
      resolved: 0,
      errors: [],
    }
    const seenIds: number[] = []
    const refCache = new Map<string, string>()

    const byRepo = new Map<string, IWorktreeView[]>()
    for (const view of projectViews) {
      const bucket = byRepo.get(view.repoPath as string) ?? []
      bucket.push(view)
      byRepo.set(view.repoPath as string, bucket)
    }
    for (const [repoPath, repoViews] of byRepo) {
      if (repoViews.length > 1) {
        scanRepo(name, repoPath, repoViews, refCache, scan, seenIds)
      }
    }

    scan.resolved = resolveMissingConflicts(name, seenIds)
    scans.push(scan)
  }
  return scans
}

export function openConflicts(project?: string): IConflict[] {
  return listOpenConflicts(project)
}
