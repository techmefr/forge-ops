import { describe, expect, it } from 'vitest'
import { cleanUpAfterMerge } from '../../../src/domain/Deployment/MergeCleanup.js'
import { WorktreeNotFoundError } from '../../../src/domain/Worktree/WorktreeViolation.js'
import { GitCommandFailedError } from '../../../src/technical/Git/GitWorktree.js'

function tools(overrides: Partial<Parameters<typeof cleanUpAfterMerge>[0]> = {}) {
  const closed: number[] = []
  const released: number[] = []
  return {
    closed,
    released,
    input: {
      storyId: 1,
      releaseScope: (storyId: number) => {
        released.push(storyId)
        return 2
      },
      closeWorktree: (storyId: number) => {
        closed.push(storyId)
      },
      ...overrides,
    },
  }
}

describe('cleanUpAfterMerge', () => {
  it('frees the scope the story was holding', () => {
    const { input, released } = tools()

    cleanUpAfterMerge(input)

    expect(released).toEqual([1])
  })

  it('reports how many scopes it freed', () => {
    expect(cleanUpAfterMerge(tools().input).scopesReleased).toBe(2)
  })

  it('closes the worktree, so the folder does not rot', () => {
    const { input, closed } = tools()

    cleanUpAfterMerge(input)

    expect(closed).toEqual([1])
  })

  it('says the worktree is gone', () => {
    expect(cleanUpAfterMerge(tools().input).worktreeClosed).toBe(true)
  })

  it('does not complain about a story that never had a worktree', () => {
    const { input } = tools({
      closeWorktree: () => {
        throw new WorktreeNotFoundError('FORGE-1')
      },
    })

    expect(cleanUpAfterMerge(input).worktreeClosed).toBe(false)
  })

  it('still frees the scope when the worktree cannot be closed', () => {
    const { input, released } = tools({
      closeWorktree: () => {
        throw new WorktreeNotFoundError('FORGE-1')
      },
    })

    cleanUpAfterMerge(input)

    expect(released).toEqual([1])
  })

  it('reports why the worktree survived, rather than pretending it is gone', () => {
    const { input } = tools({
      closeWorktree: () => {
        throw new GitCommandFailedError(['worktree', 'remove'], 'le dossier est verrouille')
      },
    })

    expect(cleanUpAfterMerge(input).worktreeRefusal).toMatch(/verrouille/)
  })

  it('does not let a git failure swallow the merge itself', () => {
    const { input } = tools({
      closeWorktree: () => {
        throw new GitCommandFailedError(['worktree', 'remove'], 'le dossier est verrouille')
      },
    })

    expect(() => cleanUpAfterMerge(input)).not.toThrow()
  })

  it('lets an unexpected failure through, it is not ours to hide', () => {
    const { input } = tools({
      closeWorktree: () => {
        throw new TypeError('nawak')
      },
    })

    expect(() => cleanUpAfterMerge(input)).toThrow(TypeError)
  })
})
