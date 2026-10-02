import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { carryLocalSettings, excludeLocalFiles } from '../../../src/technical/Guardrail/LocalSettings.js'
import { commitFiles, createGitProject, git, type GitProject } from '../../support/GitProject.js'

const TOKEN_SETTINGS = '{"hooks":{"PostToolUse":[{"hooks":[{"type":"http","headers":{"x-forge-token":"secret-token"}}]}]}}\n'

let project: GitProject
let worktree: string

beforeEach(() => {
  project = createGitProject()
  worktree = join(project.scratch, 'story-worktree')
  commitFiles(project.checkout, { '.claude/settings.json': '{}\n' }, 'chore: share the guardrails')
  git(project.checkout, 'worktree', 'add', '-q', '-b', 'forge/story-1', worktree)
})

afterEach(() => {
  project.remove()
})

describe('excludeLocalFiles', () => {
  it('keeps the local settings out of git status without touching a tracked file', () => {
    writeFileSync(join(project.checkout, '.claude', 'settings.local.json'), TOKEN_SETTINGS)

    excludeLocalFiles(project.checkout)

    expect(git(project.checkout, 'status', '--porcelain')).toBe('')
    expect(git(project.checkout, 'ls-files')).not.toContain('settings.local.json')
  })

  it('is idempotent', () => {
    const file = excludeLocalFiles(project.checkout)
    const once = readFileSync(file ?? '', 'utf-8')

    excludeLocalFiles(project.checkout)

    expect(readFileSync(file ?? '', 'utf-8')).toBe(once)
  })

  it('answers null outside a git checkout', () => {
    expect(excludeLocalFiles(project.scratch)).toBeNull()
  })
})

describe('carryLocalSettings', () => {
  it('answers absent when the checkout has no local settings', () => {
    expect(carryLocalSettings(project.checkout, worktree)).toBe('absent')
    expect(existsSync(join(worktree, '.claude', 'settings.local.json'))).toBe(false)
  })

  it('copies the local settings into the worktree with a private mode, then reports it current', () => {
    writeFileSync(join(project.checkout, '.claude', 'settings.local.json'), TOKEN_SETTINGS)

    expect(carryLocalSettings(project.checkout, worktree)).toBe('copied')
    expect(carryLocalSettings(project.checkout, worktree)).toBe('current')

    const target = join(worktree, '.claude', 'settings.local.json')
    expect(readFileSync(target, 'utf-8')).toBe(TOKEN_SETTINGS)
    expect(statSync(target).mode & 0o777).toBe(0o600)
  })

  it('never lets the token reach a commit made with git add -A in the worktree', () => {
    writeFileSync(join(project.checkout, '.claude', 'settings.local.json'), TOKEN_SETTINGS)
    carryLocalSettings(project.checkout, worktree)
    mkdirSync(join(worktree, 'src'), { recursive: true })
    writeFileSync(join(worktree, 'src', 'a.ts'), 'export const a = 1\n')

    git(worktree, 'add', '-A')
    git(worktree, 'config', 'user.email', 'e2e@forge-ops.test')
    git(worktree, 'config', 'user.name', 'e2e')
    git(worktree, 'commit', '-q', '-s', '-m', 'feat: a')

    expect(git(worktree, 'ls-files')).not.toContain('settings.local.json')
    expect(git(worktree, 'show', '--stat', 'HEAD')).not.toContain('settings.local')
  })
})
