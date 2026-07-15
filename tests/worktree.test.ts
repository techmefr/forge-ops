import { describe, expect, it } from 'vitest'
import { worktreePathFor } from '../src/git/worktree.js'

describe('worktreePathFor', () => {
  it('places the worktree in a sibling <repo>-worktrees dir with a slugified branch', () => {
    expect(worktreePathFor('/home/gaetan/stacktim', 'feature/Login_SSO')).toBe(
      '/home/gaetan/stacktim-worktrees/feature-login-sso',
    )
  })

  it('handles a trailing path and nested branch names', () => {
    expect(worktreePathFor('/srv/apps/back', 'fix/api/v2')).toBe(
      '/srv/apps/back-worktrees/fix-api-v2',
    )
  })
})
