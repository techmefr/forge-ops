export type { Worktree } from '../../../../contract/WorkspaceContract.js'

export type WorktreeOrder = {
  storyId: number
  baseRef: string
  forgeCardId?: number
}

export type WorktreeAddition = {
  path: string
  branch: string
  baseRef: string
}

export type GitWorktreeRunner = {
  headSha: (baseRef: string) => string
  addWorktree: (addition: WorktreeAddition) => void
  removeWorktree: (path: string) => void
  deleteBranch: (branch: string) => void
  isDirty: (path: string) => boolean
}
