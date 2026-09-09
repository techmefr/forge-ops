import { describe, expect, it } from 'vitest'
import { createGitWorktree, GitCommandFailedError } from '../../../src/technical/Git/GitWorktree.js'

type Call = { argv: readonly string[]; cwd: string }

function spying(answer: string = '') {
  const calls: Call[] = []
  const git = createGitWorktree({
    repositoryRoot: '/repo',
    run: (argv, cwd) => {
      calls.push({ argv, cwd })
      return answer
    },
  })
  return { git, calls }
}

describe('headSha', () => {
  it('asks git what the base ref points at', () => {
    const { git, calls } = spying('abc123')

    expect(git.headSha('forge')).toBe('abc123')
    expect(calls[0]).toEqual({ argv: ['rev-parse', 'forge'], cwd: '/repo' })
  })
})

describe('addWorktree', () => {
  it('creates the branch and the folder in one call, from the base ref', () => {
    const { git, calls } = spying()

    git.addWorktree({ path: '/tmp/w/story-forge-1', branch: 'story/forge-1', baseRef: 'forge' })

    expect(calls[0]?.argv).toEqual([
      'worktree',
      'add',
      '-b',
      'story/forge-1',
      '/tmp/w/story-forge-1',
      'forge',
    ])
  })

  it('passes the branch as an argument, never inside a shell string', () => {
    const { git, calls } = spying()

    git.addWorktree({ path: '/tmp/w/x', branch: 'story/x; rm -rf /', baseRef: 'forge' })

    expect(calls[0]?.argv).toContain('story/x; rm -rf /')
  })
})

describe('removeWorktree', () => {
  it('removes the folder git knows about', () => {
    const { git, calls } = spying()

    git.removeWorktree('/tmp/w/story-forge-1')

    expect(calls[0]?.argv).toEqual(['worktree', 'remove', '--force', '/tmp/w/story-forge-1'])
  })
})

describe('deleteBranch', () => {
  it('asks git for a safe delete, which refuses an unmerged branch', () => {
    const { git, calls } = spying()

    git.deleteBranch('story/forge-1')

    expect(calls[0]?.argv).toEqual(['branch', '--delete', 'story/forge-1'])
  })
})

describe('isDirty', () => {
  it('reads the status inside the worktree, not in the repository root', () => {
    const { git, calls } = spying('')

    git.isDirty('/tmp/w/story-forge-1')

    expect(calls[0]).toEqual({ argv: ['status', '--porcelain'], cwd: '/tmp/w/story-forge-1' })
  })

  it('is clean on an empty status', () => {
    expect(spying('').git.isDirty('/tmp/w/x')).toBe(false)
  })

  it('is dirty as soon as git prints one line', () => {
    expect(spying(' M backend/src/x.ts').git.isDirty('/tmp/w/x')).toBe(true)
  })
})

describe('a failing git', () => {
  it('says which command failed and why', () => {
    const git = createGitWorktree({
      repositoryRoot: '/repo',
      run: () => {
        throw new GitCommandFailedError(['rev-parse', 'nawak'], 'unknown revision')
      },
    })

    expect(() => git.headSha('nawak')).toThrow(/rev-parse nawak/)
  })
})

describe('the real runner', () => {
  it('reports a failure rather than returning an empty answer', () => {
    const git = createGitWorktree({ repositoryRoot: '/repo-qui-n-existe-pas' })

    expect(() => git.headSha('forge')).toThrow(GitCommandFailedError)
  })
})
