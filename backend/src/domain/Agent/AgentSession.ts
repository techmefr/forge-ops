export {
  AGENT_LIFECYCLE_SEQUENCE,
  AGENT_PHASE_SEQUENCE,
} from '../../../../contract/AgentContract.js'
export type { AgentLifecycle, AgentPhase } from '../../../../contract/AgentContract.js'
export type { PathConflict } from '../../../../contract/WorkspaceContract.js'

import type { AgentLifecycle, AgentPhase } from '../../../../contract/AgentContract.js'

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

