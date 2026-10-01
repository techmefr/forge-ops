import type { AgentPhase } from './AgentContract.js'

export const FORGE_CARD_PROVIDERS = ['claude', 'codex'] as const

export type ForgeCardProvider = (typeof FORGE_CARD_PROVIDERS)[number]

export const DEFAULT_FORGE_CARD_PROVIDER: ForgeCardProvider = 'claude'

export type ForgeCard = {
  id: number
  reference: string
  storyIds: readonly number[]
  provider: ForgeCardProvider
  claudeSessionId: string | null
  currentPhase: AgentPhase | null
  createdAt: string
  closedAt: string | null
}

export type ForgeCardDraft = {
  storyIds: readonly number[]
  provider?: ForgeCardProvider
}

export const BACKLOG_STEP_KEY = 'backlog'

export const DONE_STEP_KEY = 'done'

export const FORGE_CARD_STATUSES = [
  'idle',
  'running',
  'failed',
  'stopped',
  'budget_exhausted',
  'to_validate',
  'human_review',
  'done',
] as const

export type ForgeCardStatus = (typeof FORGE_CARD_STATUSES)[number]

export type ForgeCardView = {
  id: number
  reference: string
  storyId: number
  storyReference: string
  title: string
  projectId: number
  subjectId: number
  subjectTitle: string
  stepKey: string
  provider: ForgeCardProvider
  status: ForgeCardStatus
  claudeSessionId: string | null
  durationSeconds: number
  costUsd: number
}

export type ForgeCardMoved = {
  card: ForgeCardView
  started: boolean
  claudeSessionId: string | null
}
