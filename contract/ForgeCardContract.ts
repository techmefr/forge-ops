import type { AgentPhase } from './AgentContract.js'

export type ForgeCard = {
  id: number
  reference: string
  storyIds: readonly number[]
  claudeSessionId: string | null
  currentPhase: AgentPhase | null
  createdAt: string
  closedAt: string | null
}

export type ForgeCardDraft = {
  storyIds: readonly number[]
}
