import { describe, expect, it } from 'vitest'
import { BRANCH_MAX_LENGTH, branchNameFor, worktreeFolderFor } from '../../../src/domain/Worktree/Branch.js'
import { BranchNameRefusedError } from '../../../src/domain/Worktree/WorktreeViolation.js'

describe('branchNameFor', () => {
  it('carries the reference and the title, so the branch says what it is', () => {
    expect(branchNameFor('FORGE-1', 'visualiser la liste des mails')).toBe(
      'story/forge-1-visualiser-la-liste-des-mails',
    )
  })

  it('folds accents, a branch name stays in ascii', () => {
    expect(branchNameFor('FORGE-1', 'créer une épreuve')).toBe('story/forge-1-creer-une-epreuve')
  })

  it('collapses anything that is not a letter or a digit', () => {
    expect(branchNameFor('FORGE-1', 'CRUD  Mail / v2 !!')).toBe('story/forge-1-crud-mail-v2')
  })

  it('never ends on a separator, git refuses that', () => {
    expect(branchNameFor('FORGE-1', 'mails...')).toBe('story/forge-1-mails')
  })

  it('stays short enough for a filesystem', () => {
    expect(branchNameFor('FORGE-1', 'x'.repeat(400)).length).toBeLessThanOrEqual(BRANCH_MAX_LENGTH)
  })

  it('still ends on a real character once truncated', () => {
    expect(branchNameFor('FORGE-1', `${'ab '.repeat(200)}`).endsWith('-')).toBe(false)
  })

  it('works on a title that carries nothing usable', () => {
    expect(branchNameFor('FORGE-1', '!!!')).toBe('story/forge-1')
  })

  it('refuses a blank reference, the branch would collide with every other', () => {
    expect(() => branchNameFor('  ', 'visualiser les mails')).toThrow(BranchNameRefusedError)
  })

  it('refuses a reference that survives to nothing', () => {
    expect(() => branchNameFor('///', 'visualiser les mails')).toThrow(BranchNameRefusedError)
  })

  it('gives two stories two different branches', () => {
    expect(branchNameFor('FORGE-1', 'les mails')).not.toBe(branchNameFor('FORGE-2', 'les mails'))
  })
})

describe('worktreeFolderFor', () => {
  it('flattens the branch into one folder name', () => {
    expect(worktreeFolderFor('story/forge-1-les-mails')).toBe('story-forge-1-les-mails')
  })

  it('never climbs out of the worktree root', () => {
    expect(worktreeFolderFor('story/../../etc')).toBe('story-etc')
  })
})
