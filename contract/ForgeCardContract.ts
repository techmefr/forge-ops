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
