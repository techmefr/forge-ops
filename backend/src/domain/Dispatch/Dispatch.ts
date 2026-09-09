import type { AgentPhase } from '../Agent/AgentSession.js'
import type { CheckpointName } from '../Checkpoint/Checkpoint.js'

export type PhaseContract = {
  phase: AgentPhase
  agentName: string
  requires: readonly CheckpointName[]
}

export const PHASE_CONTRACTS: readonly PhaseContract[] = [
  { phase: 'spec', agentName: 'architecte', requires: [] },
  { phase: 'architecture', agentName: 'architecte', requires: ['spec_done'] },
  { phase: 'tdd', agentName: 'dozer', requires: ['spec_done', 'arch_done'] },
  { phase: 'code', agentName: 'trinity', requires: ['spec_done', 'arch_done', 'tests_written'] },
  {
    phase: 'gate',
    agentName: 'galadriel',
    requires: ['spec_done', 'arch_done', 'tests_written', 'build_done'],
  },
  {
    phase: 'review',
    agentName: 'elrond',
    requires: ['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified'],
  },
  {
    phase: 'ship',
    agentName: 'gandalf',
    requires: ['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified', 'reviewed'],
  },
]

export function contractOfPhase(phase: AgentPhase): PhaseContract {
  const contract = PHASE_CONTRACTS.find((candidate) => candidate.phase === phase)
  if (contract === undefined) {
    throw new RangeError(`phase inconnue ${phase}`)
  }
  return contract
}

export type DispatchOrder = {
  storyId: number
  phase: AgentPhase
}

export type Dispatched = {
  claudeSessionId: string
  storyId: number
  phase: AgentPhase
  agentName: string
  prompt: string
  model?: string
  baseUrl?: string
}

export type SessionRunner = {
  launch: (order: LaunchOrder) => Promise<{ claudeSessionId: string }>
}

export type LaunchOrder = {
  storyId: number
  reference: string
  phase: AgentPhase
  agentName: string
  prompt: string
  model?: string
  baseUrl?: string
}
