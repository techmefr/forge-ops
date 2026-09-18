export const GROUPING_MODES = ['single', 'grouped'] as const

export type GroupingMode = (typeof GROUPING_MODES)[number]

export const DEFAULT_GROUPING: GroupingMode = 'single'

export const BATCH_STATES = ['open', 'shipped'] as const

export type BatchState = (typeof BATCH_STATES)[number]

export type Batch = {
  id: number
  projectId: number
  branch: string
  state: BatchState
  storyIds: readonly number[]
}
