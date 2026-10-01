import type { Worktree } from '../domain/Worktree/Worktree.js'
import type { WorktreeRepository } from '../domain/Worktree/WorktreeRepository.js'

export type StoryWorkspaceInput = {
  hasCheckout: (storyId: number) => boolean
  worktrees: Pick<WorktreeRepository, 'open' | 'findForStory'>
  onOpened?: (worktree: Worktree) => void
}

export type WorkspaceTarget = {
  storyId: number
  forgeCardId: number | null
}

export function createStoryWorkspace({
  hasCheckout,
  worktrees,
  onOpened,
}: StoryWorkspaceInput): (target: WorkspaceTarget) => void {
  return ({ storyId, forgeCardId }) => {
    if (!hasCheckout(storyId) || worktrees.findForStory(storyId) !== null) {
      return
    }
    const opened = worktrees.open({
      storyId,
      baseRef: 'HEAD',
      ...(forgeCardId === null ? {} : { forgeCardId }),
    })
    onOpened?.(opened)
  }
}
