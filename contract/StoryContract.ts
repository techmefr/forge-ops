import type { CheckpointName } from './CheckpointContract.js'

export const STORY_KIND_SEQUENCE = ['functional', 'test'] as const

export type StoryKind = (typeof STORY_KIND_SEQUENCE)[number]

export const STORY_STATE_SEQUENCE = [
  'drafting',
  'backlog',
  'architecture',
  'plan_review',
  'building',
  'gating',
  'reviewing',
  'shipping',
  'flagged',
  'done',
  'escalated',
] as const

export type StoryState = (typeof STORY_STATE_SEQUENCE)[number]

export const STEP_BACK_TARGETS = [
  'backlog',
  'architecture',
  'plan_review',
  'building',
  'gating',
  'reviewing',
  'shipping',
] as const

export type StepBackTarget = (typeof STEP_BACK_TARGETS)[number]

const HUMAN_DOORS: readonly StoryState[] = ['plan_review', 'shipping', 'escalated']

export const HUMAN_GATE_STATES = STORY_STATE_SEQUENCE.filter((state) => HUMAN_DOORS.includes(state))

export type HumanGateState = (typeof HUMAN_DOORS)[number]

export type HumanGateWait = {
  storyId: number
  reference: string
  state: StoryState
  waitingSince: string
  waitingSeconds: number
}

export type HumanGateStatus = HumanGateWait & {
  waitingHours: number
  overdue: boolean
  statement: string
}

export type HumanGateReport = {
  deadlineMinutes: number
  gates: readonly HumanGateStatus[]
}

export type StepBackRecord = {
  id: number
  storyId: number
  fromState: StoryState
  toState: StoryState
  reason: string
  askedBy: string
  revokedCheckpoints: readonly CheckpointName[]
  steppedBackAt: string
}

export type Project = {
  id: number
  slug: string
  name: string
  repositoryUrl: string
  integrationBranch: string
  colour: string
  checkoutPath: string | null
}

export type Epic = {
  id: number
  projectId: number
  title: string
  businessIntent: string
}

export type EpicOverview = Epic & {
  storyCount: number
  assignee: string | null
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
  blockedReason: string | null
}

export type Criterion = {
  id: number
  storyId: number
  reference: string
  statement: string
  persona: string | null
  expectsRefusal: boolean
  evidencePath: string | null
  satisfied: boolean
}

export const COMPLETENESS_FLOOR = 60

export type CompletenessVerdict = {
  score: number
  launchable: boolean
  gaps: readonly string[]
}

export const MILESTONE_KINDS = ['demo', 'production', 'everyone'] as const

export type MilestoneKind = (typeof MILESTONE_KINDS)[number]

export type Milestone = {
  epicId: number
  kind: MilestoneKind
  dueOn: string
}
