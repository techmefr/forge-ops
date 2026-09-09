export type Worktree = {
  id: number
  storyId: number
  storyReference: string
  path: string
  branch: string
  baseRef: string
  baseSha: string
  port: number
  subdomain: string
  createdAt: string
}

export type WorktreeOrder = {
  storyId: number
  baseRef: string
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
  isDirty: (path: string) => boolean
}
