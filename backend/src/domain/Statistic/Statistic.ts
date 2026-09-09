import type { AgentLifecycle, AgentPhase } from '../Agent/AgentSession.js'
import type { OutcomeClass } from '../Agent/SessionOutcome.js'

export type SessionHistoryEntry = {
  id: number
  storyId: number
  storyReference: string
  phase: AgentPhase
  agentName: string
  lifecycle: AgentLifecycle
  outcome: OutcomeClass | null
  costUsd: number | null
  inputTokens: number | null
  outputTokens: number | null
  startedAt: string
  endedAt: string | null
  seconds: number | null
}

export type AgentTally = {
  agentName: string
  sessions: number
  totalSeconds: number
  totalCostUsd: number
}

export type PhaseTally = {
  phase: AgentPhase
  sessions: number
  totalSeconds: number
}

export type OutcomeTally = {
  outcome: OutcomeClass
  sessions: number
}

export type BoardStatistics = {
  sessions: number
  totalCostUsd: number
  totalSeconds: number
  agents: readonly AgentTally[]
  phases: readonly PhaseTally[]
  outcomes: readonly OutcomeTally[]
}
