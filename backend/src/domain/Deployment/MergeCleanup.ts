import { GitCommandFailedError } from '../../technical/Git/GitWorktree.js'
import { WorktreeViolationError } from '../Worktree/WorktreeViolation.js'

export type MergeCleanupInput = {
  storyId: number
  releaseScope: (storyId: number) => number
  closeWorktree: (storyId: number) => void
}

export type MergeCleanupReport = {
  scopesReleased: number
  worktreeClosed: boolean
  worktreeRefusal: string | null
}

export function cleanUpAfterMerge({
  storyId,
  releaseScope,
  closeWorktree,
}: MergeCleanupInput): MergeCleanupReport {
  const scopesReleased = releaseScope(storyId)
  try {
    closeWorktree(storyId)
    return { scopesReleased, worktreeClosed: true, worktreeRefusal: null }
  } catch (error) {
    if (error instanceof WorktreeViolationError || error instanceof GitCommandFailedError) {
      return { scopesReleased, worktreeClosed: false, worktreeRefusal: error.message }
    }
    throw error
  }
}
