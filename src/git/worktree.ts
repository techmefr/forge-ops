import { execFileSync } from 'node:child_process'
import { basename, dirname, join } from 'node:path'

export interface IWorktreeRemoval {
  removed: boolean
  path: string | null
  detail: string
}

export interface IWorktreeCreation {
  created: boolean
  path: string | null
  detail: string
}

function git(repoPath: string | null, args: string[]): string {
  const fullArgs = repoPath !== null ? ['-C', repoPath, ...args] : args
  return execFileSync('git', fullArgs, { encoding: 'utf-8' })
}

function slugify(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Chemin ou sera creee la worktree : dossier voisin du repo,
 * `<repo>-worktrees/<slug-de-branche>`. Fonction pure, testable.
 */
export function worktreePathFor(repoPath: string, branch: string): string {
  const parent = dirname(repoPath)
  const base = basename(repoPath)
  return join(parent, `${base}-worktrees`, slugify(branch))
}

function branchExists(repoPath: string, branch: string): boolean {
  try {
    git(repoPath, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])
    return true
  } catch {
    return false
  }
}

/**
 * Cree reellement la worktree git pour une branche (`git worktree add`).
 * C'est la symetrie manquante de `removeWorktreeForBranch` : jusqu'ici
 * starfleet enregistrait un port mais ne creait jamais la worktree.
 */
export function addWorktreeForBranch(repoPath: string, branch: string): IWorktreeCreation {
  const path = worktreePathFor(repoPath, branch)
  try {
    const args = branchExists(repoPath, branch)
      ? ['worktree', 'add', path, branch]
      : ['worktree', 'add', '-b', branch, path]
    git(repoPath, args)
    return { created: true, path, detail: `Worktree creee: ${path}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { created: false, path, detail: `git worktree add a echoue: ${message}` }
  }
}

export function removeWorktreeForBranch(
  branch: string,
  repoPath: string | null = null,
): IWorktreeRemoval {
  let porcelain: string
  try {
    porcelain = git(repoPath, ['worktree', 'list', '--porcelain'])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { removed: false, path: null, detail: `git worktree list a echoue: ${message}` }
  }

  const path = findWorktreePath(porcelain, branch)
  if (path === null) {
    return { removed: false, path: null, detail: 'Aucune worktree git rattachee a cette branche' }
  }

  try {
    git(repoPath, ['worktree', 'remove', path])
    return { removed: true, path, detail: `Worktree supprimee: ${path}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { removed: false, path, detail: `git worktree remove a echoue: ${message}` }
  }
}

function findWorktreePath(porcelain: string, branch: string): string | null {
  const target = `refs/heads/${branch}`
  let currentPath: string | null = null
  for (const line of porcelain.split('\n')) {
    if (line.startsWith('worktree ')) {
      currentPath = line.slice('worktree '.length).trim()
    } else if (line.startsWith('branch ') && line.slice('branch '.length).trim() === target) {
      return currentPath
    }
  }
  return null
}
