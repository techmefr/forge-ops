import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  checkMergeConflict,
  committedFiles,
  dirtyCommit,
  dirtyFiles,
  parseMergeTree,
  parseStatusPaths,
  parseWorktreeList,
  resolveBase,
  runGit,
} from '../src/git/inspect.js'

describe('parseWorktreeList', () => {
  it('reads the path, head and short branch of every worktree', () => {
    const porcelain = [
      'worktree /home/dev/app',
      'HEAD abc123',
      'branch refs/heads/main',
      '',
      'worktree /home/dev/app-worktrees/feat-login',
      'HEAD def456',
      'branch refs/heads/feat/login',
      '',
    ].join('\n')
    expect(parseWorktreeList(porcelain)).toEqual([
      { path: '/home/dev/app', head: 'abc123', branch: 'main' },
      { path: '/home/dev/app-worktrees/feat-login', head: 'def456', branch: 'feat/login' },
    ])
  })

  it('keeps a detached worktree, with no branch', () => {
    const porcelain = 'worktree /home/dev/app\nHEAD abc123\ndetached\n'
    expect(parseWorktreeList(porcelain)).toEqual([
      { path: '/home/dev/app', head: 'abc123', branch: null },
    ])
  })
})

describe('parseStatusPaths', () => {
  it('collects paths across staged, unstaged and untracked entries', () => {
    const porcelain = ['M  src/a.ts', ' M src/b.ts', '?? src/c.ts'].join('\n')
    expect(parseStatusPaths(porcelain)).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts'])
  })

  it('counts both sides of a rename, since both are in flight', () => {
    expect(parseStatusPaths('R  src/old.ts -> src/new.ts')).toEqual(['src/new.ts', 'src/old.ts'])
  })

  it('unquotes a path git had to escape', () => {
    expect(parseStatusPaths('?? "src/a b.ts"')).toEqual(['src/a b.ts'])
  })
})

describe('parseMergeTree', () => {
  it('returns the tree alone when the merge is clean', () => {
    expect(parseMergeTree('9a1b2c3\n')).toEqual({ tree: '9a1b2c3', files: [] })
  })

  it('reads the conflicted file section and stops at the informational messages', () => {
    const stdout = [
      '9a1b2c3',
      '',
      'src/a.ts',
      'src/b.ts',
      '',
      'CONFLICT (content): Merge conflict in src/a.ts',
      '',
    ].join('\n')
    expect(parseMergeTree(stdout)).toEqual({ tree: '9a1b2c3', files: ['src/a.ts', 'src/b.ts'] })
  })
})

const LONG_FILE = Array.from({ length: 12 }, (_value, index) => `export const line${index} = ${index}\n`).join('')

describe('git inspection on a real repository', () => {
  let repo: string

  const git = (...args: string[]): void => {
    const result = runGit(repo, args)
    if (!result.ok) {
      throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
    }
  }

  const write = (name: string, content: string): void => {
    writeFileSync(join(repo, name), content, 'utf-8')
  }

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'starfleet-git-'))
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    write('shared.ts', 'export const value = 0\n')
    write('untouched.ts', LONG_FILE)
    git('add', '.')
    git('commit', '-m', 'init')

    git('checkout', '-b', 'feat/left')
    write('shared.ts', 'export const value = 1\n')
    write('left-only.ts', 'export const left = true\n')
    git('add', '.')
    git('commit', '-m', 'left')

    git('checkout', 'main')
    git('checkout', '-b', 'feat/right')
    write('shared.ts', 'export const value = 2\n')
    git('add', '.')
    git('commit', '-m', 'right')

    git('checkout', 'main')
    git('checkout', '-b', 'feat/elsewhere')
    write('untouched.ts', LONG_FILE.replace('export const line0 = 0', 'export const line0 = 9'))
    git('add', '.')
    git('commit', '-m', 'elsewhere')
    git('checkout', 'main')
  })

  afterAll(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('resolves main as the base branch when there is no develop', () => {
    expect(resolveBase(repo)).toBe('main')
  })

  it('lists what a branch added, not what the base moved', () => {
    expect(committedFiles(repo, 'main', 'feat/left')).toEqual(['left-only.ts', 'shared.ts'])
  })

  it('reports a real conflict, named file by file', () => {
    const check = checkMergeConflict(repo, 'feat/left', 'feat/right')
    expect(check.ok).toBe(true)
    expect(check.conflicted).toBe(true)
    expect(check.files).toEqual(['shared.ts'])
  })

  it('reports no conflict for two branches that never meet', () => {
    const check = checkMergeConflict(repo, 'feat/left', 'feat/elsewhere')
    expect(check.ok).toBe(true)
    expect(check.conflicted).toBe(false)
    expect(check.files).toEqual([])
  })

  it('touching the same file is not a conflict on its own', () => {
    git('checkout', 'feat/left')
    write('untouched.ts', `${LONG_FILE}export const appended = 1\n`)
    git('add', '.')
    git('commit', '-m', 'left touches untouched.ts at the end')
    git('checkout', 'main')

    const overlap = committedFiles(repo, 'main', 'feat/left').filter((file) =>
      committedFiles(repo, 'main', 'feat/elsewhere').includes(file),
    )
    expect(overlap).toContain('untouched.ts')
    expect(checkMergeConflict(repo, 'feat/left', 'feat/elsewhere').conflicted).toBe(false)
  })

  it('sees uncommitted work, and gives it a commit without touching the worktree', () => {
    git('checkout', 'feat/right')
    write('shared.ts', 'export const value = 3\n')
    expect(dirtyFiles(repo)).toEqual(['shared.ts'])

    const sha = dirtyCommit(repo)
    expect(sha).not.toBeNull()
    expect(runGit(repo, ['stash', 'list']).stdout.trim()).toBe('')
    expect(dirtyFiles(repo)).toEqual(['shared.ts'])

    const check = checkMergeConflict(repo, 'feat/left', sha as string)
    expect(check.conflicted).toBe(true)
    expect(check.files).toEqual(['shared.ts'])
    git('checkout', '--', 'shared.ts')
    git('checkout', 'main')
  })

  it('returns null for a clean worktree instead of an empty commit', () => {
    expect(dirtyCommit(repo)).toBeNull()
  })
})
