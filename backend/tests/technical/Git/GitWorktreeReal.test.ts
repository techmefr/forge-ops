import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createGitWorktree } from '../../../src/technical/Git/GitWorktree.js'
import { createGitProject, git, type GitProject } from '../../support/GitProject.js'

let project: GitProject
let worktree: string

beforeEach(() => {
  project = createGitProject()
  worktree = join(project.scratch, 'worktree')
  git(project.checkout, 'worktree', 'add', '-b', 'story/x', worktree)
})

afterEach(() => {
  project.remove()
})

describe('isDirty on a real worktree', () => {
  it('is clean when only the forge files under .claude are untracked', () => {
    mkdirSync(join(worktree, '.claude', 'evidence', 'FORGE-1'), { recursive: true })
    writeFileSync(join(worktree, '.claude', 'evidence', 'FORGE-1', 'spec.verdict.json'), '{}')
    writeFileSync(join(worktree, '.claude', 'settings.local.json'), '{}')

    expect(createGitWorktree({ repositoryRoot: project.checkout }).isDirty(worktree)).toBe(false)
  })

  it('is dirty as soon as a file outside .claude changes', () => {
    writeFileSync(join(worktree, 'README.md'), 'changed\n')

    expect(createGitWorktree({ repositoryRoot: project.checkout }).isDirty(worktree)).toBe(true)
  })

  it('is dirty with a new untracked source file', () => {
    writeFileSync(join(worktree, 'notes.js'), 'export const notes = 1\n')

    expect(createGitWorktree({ repositoryRoot: project.checkout }).isDirty(worktree)).toBe(true)
  })
})
