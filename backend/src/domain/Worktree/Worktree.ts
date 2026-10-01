export type { Worktree } from '../../../../contract/WorkspaceContract.js'

import { z } from 'zod'

export const baseRefSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_.][A-Za-z0-9_./@~^-]*$/)
  .refine((ref) => !ref.includes('..') && !ref.endsWith('.lock'))
  .default('HEAD')

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
