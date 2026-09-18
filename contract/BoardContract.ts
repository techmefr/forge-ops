import type { DefinitionOfDoneStep, ReviewPass } from './CheckpointContract.js'
import type {
  CompletenessVerdict,
  Criterion,
  Milestone,
  StepBackRecord,
  Story,
  StoryState,
} from './StoryContract.js'

export type KanbanColumnKey = Extract<
  StoryState,
  | 'backlog'
  | 'architecture'
  | 'plan_review'
  | 'building'
  | 'gating'
  | 'reviewing'
  | 'shipping'
  | 'flagged'
  | 'done'
>

export type KanbanColumn = {
  key: KanbanColumnKey
  label: string
  colour: string
}

export type SessionUsage = {
  costUsd: number
  inputTokens: number
  outputTokens: number
}

export type KanbanStory = Story & {
  usage: SessionUsage
  blockers: readonly string[]
}

export type Ticket = {
  functional: Story
  tests: Story | null
  criteria: readonly Criterion[]
  dod: readonly DefinitionOfDoneStep[]
  cascade: readonly ReviewPass[]
  blockers: readonly string[]
  stepBacks: readonly StepBackRecord[]
  completeness: CompletenessVerdict
}

export type ReportFact =
  | { kind: 'checkpoint'; statement: string; evidencePath: string }
  | { kind: 'criterion'; statement: string; evidencePath: string }
  | { kind: 'cost'; statement: string; costUsd: number; inputTokens: number; outputTokens: number }

export const JUDGEMENT_KIND_SEQUENCE = ['finding', 'criterion_unmet', 'blocker'] as const

export type JudgementKind = (typeof JUDGEMENT_KIND_SEQUENCE)[number]

export type ReportJudgement =
  | { kind: 'finding'; statement: string; lens: string; severity: string; path: string }
  | { kind: 'criterion_unmet'; statement: string; reference: string }
  | { kind: 'blocker'; statement: string; reference: string }

export type StoryReport = {
  facts: readonly ReportFact[]
  judgements: readonly ReportJudgement[]
}

export const REMARK_VOICE_SEQUENCE = ['human', 'agent'] as const

export type RemarkVoice = (typeof REMARK_VOICE_SEQUENCE)[number]

export type StoryRemark = {
  id: number
  storyId: number
  author: string
  voice: RemarkVoice
  body: string
  writtenAt: string
}

export type StoryHold = {
  id: number
  storyId: number
  reason: string
  askedBy: string
  raisedAt: string
}

export type Discussion = {
  remarks: readonly StoryRemark[]
  hold: StoryHold | null
}

export const ATTENTIONS = ['blocked', 'conflict', 'gate', 'late'] as const

export type Attention = (typeof ATTENTIONS)[number]

export type ProjectCard = KanbanStory & {
  projectSlug: string
  projectColour: string
  epicTitle: string
  holder: string | null
  milestone: Milestone | null
  daysLeft: number | null
  attention: Attention | null
}
