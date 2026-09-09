export type AgentPhase = 'spec' | 'architecture' | 'tdd' | 'code' | 'gate' | 'review' | 'ship'

export type AgentLifecycle = 'starting' | 'working' | 'awaiting_human' | 'finished' | 'failed' | 'interrupted'

export type AgentSession = {
  id: number
  storyId: number
  claudeSessionId: string
  phase: AgentPhase
  agentName: string
  lifecycle: AgentLifecycle
  claudeCodeVersion: string
  costUsd: number | null
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
