import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { listGitWorktrees, runGit } from './git/inspect.js'

const CACHE_TTL_MS = 3000

export interface IDiscoveredWorktree {
  project: string
  repoPath: string
  worktreePath: string
  branch: string | null
  head: string | null
  isMain: boolean
}

interface ICache {
  at: number
  roots: string
  value: IDiscoveredWorktree[]
}

let cache: ICache | null = null

export function scanRoots(): string[] {
  const configured = process.env.STARFLEET_SCAN_ROOTS
  if (configured !== undefined && configured.trim() !== '') {
    return configured
      .split(':')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')
      .map((entry) => resolve(entry))
  }
  return [homedir()]
}

/**
 * Un depot est un dossier qui contient `.git` — fichier compris, c'est comme ca
 * qu'une worktree liee reference son depot principal.
 */
export function isRepo(path: string): boolean {
  return existsSync(join(path, '.git'))
}

function childDirectories(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => join(root, entry.name))
  } catch {
    return []
  }
}

/**
 * Depots trouves sous les racines : la racine elle-meme si c'en est un, sinon
 * ses enfants directs. On ne descend pas plus bas — un scan recursif d'un home
 * complet coute cher et ramene surtout des `node_modules`.
 */
export function findRepos(roots: string[]): string[] {
  const repos = new Set<string>()
  for (const root of roots) {
    if (isRepo(root)) {
      repos.add(root)
      continue
    }
    for (const child of childDirectories(root)) {
      if (isRepo(child)) {
        repos.add(child)
      }
    }
  }
  return [...repos].sort()
}

/**
 * Le nom de projet est celui du depot principal, jamais celui du dossier de
 * worktree : `<repo>-worktrees/feat-x` et `<repo>` sont le meme projet.
 */
function mainRepoPath(repoPath: string): string {
  const result = runGit(repoPath, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  if (!result.ok) {
    return repoPath
  }
  const commonDir = result.stdout.trim()
  return commonDir.endsWith('/.git') ? commonDir.slice(0, -'/.git'.length) : repoPath
}

export function discoverWorktrees(roots: string[] = scanRoots()): IDiscoveredWorktree[] {
  const key = roots.join(':')
  const now = Date.now()
  if (cache !== null && cache.roots === key && now - cache.at < CACHE_TTL_MS) {
    return cache.value
  }

  const byPath = new Map<string, IDiscoveredWorktree>()
  for (const repoPath of findRepos(roots)) {
    const main = mainRepoPath(repoPath)
    const project = basename(main)
    for (const worktree of listGitWorktrees(repoPath)) {
      if (byPath.has(worktree.path)) {
        continue
      }
      byPath.set(worktree.path, {
        project,
        repoPath: main,
        worktreePath: worktree.path,
        branch: worktree.branch,
        head: worktree.head,
        isMain: worktree.path === main,
      })
    }
  }

  const value = [...byPath.values()].sort((left, right) => {
    if (left.project !== right.project) {
      return left.project.localeCompare(right.project)
    }
    if (left.isMain !== right.isMain) {
      return left.isMain ? -1 : 1
    }
    return (left.branch ?? '').localeCompare(right.branch ?? '')
  })

  cache = { at: now, roots: key, value }
  return value
}

export function clearDiscoveryCache(): void {
  cache = null
}
