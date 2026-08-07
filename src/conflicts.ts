import { existsSync } from 'node:fs'
import { listTasks } from './db/tasks.js'
import { listOpenConflicts, resolveMissingConflicts, upsertConflict } from './db/conflicts.js'
import { checkMergeConflict, dirtyCommit } from './git/inspect.js'
import type { IConflict, ITask, TaskCheckpoint } from './types/task.js'

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

export function isFrozen(task: ITask): boolean {
  return task.lastCheckpoint !== null && FROZEN_CHECKPOINTS.includes(task.lastCheckpoint)
}

export function isInHumanReview(task: ITask): boolean {
  return task.status === 'awaiting_human' || task.lastCheckpoint === 'mr_draft_pushed'
}

/**
 * Regle par defaut : le cote qui n'est pas encore en relecture humaine bouge.
 * Quand les deux le sont, ou aucun, starfleet ne tranche pas — c'est le dev.
 */
export function decideArbitration(left: ITask, right: ITask): string | null {
  const leftReviewed = isInHumanReview(left)
  const rightReviewed = isInHumanReview(right)
  if (leftReviewed === rightReviewed) {
    return null
  }
  return leftReviewed ? right.branch : left.branch
}

export function orderPair(left: ITask, right: ITask): [ITask, ITask] {
  return left.branch.localeCompare(right.branch) <= 0 ? [left, right] : [right, left]
}

/**
 * Reference a comparer pour une worktree : l'etat sale quand il y en a un (commit
 * ecrit par `git stash create`, sans toucher au working tree ni a la pile de
 * stash), sinon la branche.
 */
function comparableRef(task: ITask): string {
  if (task.worktreePath !== null && existsSync(task.worktreePath)) {
    return dirtyCommit(task.worktreePath) ?? task.branch
  }
  return task.branch
}

export interface IConflictScan {
  project: string
  pairsChecked: number
  conflicts: IConflict[]
  resolved: number
  errors: string[]
}

function scanProject(project: string, tasks: ITask[]): IConflictScan {
  const scan: IConflictScan = {
    project,
    pairsChecked: 0,
    conflicts: [],
    resolved: 0,
    errors: [],
  }
  const eligible = tasks.filter((task) => task.repoPath !== null && existsSync(task.repoPath))
  const seenIds: number[] = []

  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      const [left, right] = orderPair(eligible[i] as ITask, eligible[j] as ITask)
      const repoPath = left.repoPath as string
      const check = checkMergeConflict(repoPath, comparableRef(left), comparableRef(right))
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

  scan.resolved = resolveMissingConflicts(project, seenIds)
  return scan
}

export function scanConflicts(project?: string): IConflictScan[] {
  const tasks = listTasks().filter((task) => project === undefined || task.project === project)
  const byProject = new Map<string, ITask[]>()
  for (const task of tasks) {
    const bucket = byProject.get(task.project) ?? []
    bucket.push(task)
    byProject.set(task.project, bucket)
  }
  return [...byProject.entries()].map(([name, group]) => scanProject(name, group))
}

export function openConflicts(project?: string): IConflict[] {
  return listOpenConflicts(project)
}
