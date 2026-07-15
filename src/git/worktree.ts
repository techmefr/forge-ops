import { execFileSync } from 'node:child_process'

export interface IWorktreeRemoval {
  removed: boolean
  path: string | null
  detail: string
}

/**
 * Retrouve le chemin de la worktree git rattachee a une branche via
 * `git worktree list --porcelain`, puis la supprime avec `git worktree remove`.
 * Sans ca, `cleanup` ne faisait que supprimer la ligne SQLite en laissant la
 * worktree et son port vivants — exactement le desynchronisation etat/reel que
 * starfleet est cense empecher.
 */
export function removeWorktreeForBranch(branch: string): IWorktreeRemoval {
  let porcelain: string
  try {
    porcelain = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      encoding: 'utf-8',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { removed: false, path: null, detail: `git worktree list a echoue: ${message}` }
  }

  const path = findWorktreePath(porcelain, branch)
  if (path === null) {
    return { removed: false, path: null, detail: 'Aucune worktree git rattachee a cette branche' }
  }

  try {
    execFileSync('git', ['worktree', 'remove', path], { encoding: 'utf-8' })
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
