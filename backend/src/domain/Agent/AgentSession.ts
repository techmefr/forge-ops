export const AGENT_PHASE_SEQUENCE = [
  'spec',
  'architecture',
  'tdd',
  'code',
  'gate',
  'review',
  'ship',
] as const

export type AgentPhase = (typeof AGENT_PHASE_SEQUENCE)[number]

export const AGENT_LIFECYCLE_SEQUENCE = [
  'starting',
  'working',
  'awaiting_human',
  'finished',
  'failed',
  'interrupted',
] as const

export type AgentLifecycle = (typeof AGENT_LIFECYCLE_SEQUENCE)[number]

export type AgentSession = {
  id: number
  storyId: number
  claudeSessionId: string
  phase: AgentPhase
  agentName: string
  lifecycle: AgentLifecycle
  claudeCodeVersion: string
  costUsd: number
}

export type AgentSessionDraft = {
  storyId: number
  claudeSessionId: string
  phase: AgentPhase
  agentName: string
  claudeCodeVersion: string
}

export type FileTouchDraft = {
  claudeSessionId: string
  path: string
}

export type PathConflict = {
  path: string
  storyIds: readonly number[]
}
