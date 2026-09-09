import { execFileSync } from 'node:child_process'

export class GitCommandFailedError extends Error {
  readonly argv: readonly string[]

  constructor(argv: readonly string[], reason: string) {
    super(`git ${argv.join(' ')} a echoue : ${reason}`)
    this.name = 'GitCommandFailedError'
    this.argv = argv
  }
}

export type GitWorktreeInput = {
  repositoryRoot: string
  run?: (argv: readonly string[], cwd: string) => string
}

function runGit(argv: readonly string[], cwd: string): string {
  try {
    return execFileSync('git', [...argv], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr
    const reason =
      typeof stderr === 'string'
        ? stderr.trim()
        : stderr instanceof Buffer
          ? stderr.toString('utf-8').trim()
          : error instanceof Error
            ? error.message
            : String(error)
    throw new GitCommandFailedError(argv, reason === '' ? 'aucune sortie' : reason)
  }
}

export function createGitWorktree({ repositoryRoot, run = runGit }: GitWorktreeInput) {
  return {
    headSha: (baseRef: string) => run(['rev-parse', baseRef], repositoryRoot),

    addWorktree: ({ path, branch, baseRef }: { path: string; branch: string; baseRef: string }) => {
      run(['worktree', 'add', '-b', branch, path, baseRef], repositoryRoot)
    },

    removeWorktree: (path: string) => {
      run(['worktree', 'remove', '--force', path], repositoryRoot)
    },

    isDirty: (path: string) => run(['status', '--porcelain'], path) !== '',
  }
}
