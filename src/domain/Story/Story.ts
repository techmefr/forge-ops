export type StoryKind = 'functional' | 'test'

export type StoryState =
  | 'drafting'
  | 'backlog'
  | 'architecture'
  | 'blocked'
  | 'building'
  | 'gating'
  | 'reviewing'
  | 'shipping'
  | 'done'
  | 'escalated'

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

export type Story = {
  id: number
  epicId: number
  twinOfStoryId: number | null
  reference: string
  title: string
  body: string
  kind: StoryKind
  state: StoryState
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
