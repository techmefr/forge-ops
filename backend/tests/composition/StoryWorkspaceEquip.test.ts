import { describe, expect, it } from 'vitest'
import { createStoryWorkspace } from '../../src/composition/StoryWorkspace.js'
import type { Worktree } from '../../src/domain/Worktree/Worktree.js'

const WORKTREE = { id: 1, storyId: 7, path: '/tmp/story-7', branch: 'forge/story-7' } as unknown as Worktree

describe('story workspace equipment', () => {
  it('equips a worktree it has just opened', () => {
    const equipped: Worktree[] = []
    const open = createStoryWorkspace({
      hasCheckout: () => true,
      worktrees: { open: () => WORKTREE, findForStory: () => null },
      equip: (worktree) => equipped.push(worktree),
    })

    open({ storyId: 7, forgeCardId: null })

    expect(equipped).toEqual([WORKTREE])
  })

  it('equips a worktree that already exists, so an older one picks up the settings', () => {
    const equipped: Worktree[] = []
    const open = createStoryWorkspace({
      hasCheckout: () => true,
      worktrees: {
        open: () => {
          throw new Error('must not open a second worktree')
        },
        findForStory: () => WORKTREE,
      },
      equip: (worktree) => equipped.push(worktree),
    })

    open({ storyId: 7, forgeCardId: null })

    expect(equipped).toEqual([WORKTREE])
  })

  it('does nothing for a story without a checkout', () => {
    const equipped: Worktree[] = []
    const open = createStoryWorkspace({
      hasCheckout: () => false,
      worktrees: { open: () => WORKTREE, findForStory: () => null },
      equip: (worktree) => equipped.push(worktree),
    })

    open({ storyId: 7, forgeCardId: null })

    expect(equipped).toEqual([])
  })
})
