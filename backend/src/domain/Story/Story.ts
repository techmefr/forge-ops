export type StoryKind = 'functional' | 'test'

export type StoryState =
  | 'drafting'
  | 'backlog'
  | 'architecture'
  | 'plan_review'
  | 'building'
  | 'gating'
  | 'reviewing'
  | 'shipping'
  | 'flagged'
  | 'done'
  | 'escalated'

export type KanbanColumnKey = Extract<
  StoryState,
  'architecture' | 'plan_review' | 'building' | 'gating' | 'reviewing' | 'shipping' | 'flagged' | 'done'
>

export type KanbanColumn = {
  key: KanbanColumnKey
  label: string
  colour: string
}

export const KANBAN_COLUMNS: readonly KanbanColumn[] = [
  { key: 'architecture', label: 'Architecture', colour: 'info' },
  { key: 'plan_review', label: 'Plan à valider', colour: 'warn' },
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

export type Project = {
  id: number
  slug: string
  name: string
  repositoryUrl: string
  integrationBranch: string
  colour: string
}

export type Epic = {
  id: number
  projectId: number
  title: string
  businessIntent: string
}

export type EpicOverview = Epic & {
  storyCount: number
}

export type Story = {
  id: number
  epicId: number
  twinOfStoryId: number | null
  reference: string
  title: string
  body: string
  kind: StoryKind
  state: StoryState
  points: number | null
  rolloutPercent: number | null
  mergeConflict: boolean
  escalationReason: string | null
}

export type ProjectDraft = Omit<Project, 'id'>

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
