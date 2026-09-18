export { STORY_STATE_SEQUENCE } from '../../../../contract/StoryContract.js'
export type {
  Epic,
  EpicOverview,
  Project,
  Story,
  StoryKind,
  StoryState,
} from '../../../../contract/StoryContract.js'
export type { KanbanColumn, KanbanColumnKey } from '../../../../contract/BoardContract.js'

import type { Epic, Project, StoryState } from '../../../../contract/StoryContract.js'
import type { KanbanColumn, KanbanColumnKey } from '../../../../contract/BoardContract.js'

export const KANBAN_COLUMNS: readonly KanbanColumn[] = [
  { key: 'backlog', label: 'Reserve', colour: 'line' },
  { key: 'architecture', label: 'Plan', colour: 'info' },
  { key: 'plan_review', label: 'Plan a valider', colour: 'warn' },
  { key: 'building', label: 'Dev', colour: 'acc' },
  { key: 'gating', label: 'Test', colour: 'info' },
  { key: 'reviewing', label: 'Review', colour: 'violet' },
  { key: 'shipping', label: 'Merge', colour: 'orange' },
  { key: 'flagged', label: 'Feature flag', colour: 'violet' },
  { key: 'done', label: 'Prod', colour: 'green' },
]

export function columnOfState(state: StoryState): KanbanColumnKey | null {
  const column = KANBAN_COLUMNS.find((candidate) => candidate.key === state)
  return column === undefined ? null : column.key
}

export type ProjectDraft = Omit<Project, 'id' | 'checkoutPath'> & { checkoutPath?: string | null }

export type EpicDraft = Omit<Epic, 'id'>

export type StoryDraft = {
  epicId: number
  title: string
  body: string
}

export type TwinDraft = {
  storyId: number
  title: string
  body: string
}

export type Dependency = {
  blockedStoryId: number
  blockingStoryId: number
}
