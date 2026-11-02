import type { AgentPhase } from './AgentContract.js'

export type SessionRunner = {
  launch: (order: LaunchOrder) => Promise<{ claudeSessionId: string }>
  abandon?: (claudeSessionId: string) => void
}

export type LaunchOrder = {
  storyId: number
  reference: string
  phase: AgentPhase
  agentName: string
  prompt: string
  model?: string
  baseUrl?: string
  provider?: string
  effort?: string
  forgeCardId?: number
  resumeSessionId?: string
}
