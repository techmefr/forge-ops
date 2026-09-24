import type { AgentPhase } from '../Agent/AgentSession.js'
import type { CheckpointName, ReviewLens } from '../Checkpoint/Checkpoint.js'

export type PhaseContract = {
  phase: AgentPhase
  agentName: string
  command: string
  proves: CheckpointName | null
  requires: readonly CheckpointName[]
}

export const PHASE_CONTRACTS: readonly PhaseContract[] = [
  { phase: 'spec', agentName: 'architecte', command: 'SPEC.md', proves: 'spec_done', requires: [] },
  {
    phase: 'architecture',
    agentName: 'architecte',
    command: 'PLAN.md',
    proves: 'arch_done',
    requires: ['spec_done'],
  },
  {
    phase: 'tdd',
    agentName: 'dozer',
    command: 'TEST.md',
    proves: 'tests_written',
    requires: ['spec_done', 'arch_done'],
  },
  {
    phase: 'code',
    agentName: 'trinity',
    command: 'BUILD.md',
    proves: 'build_done',
    requires: ['spec_done', 'arch_done', 'tests_written'],
  },
  {
    phase: 'gate',
    agentName: 'galadriel',
    command: 'VERIFY.md',
    proves: 'verified',
    requires: ['spec_done', 'arch_done', 'tests_written', 'build_done'],
  },
  {
    phase: 'review',
    agentName: 'elrond',
    command: 'REVIEW.md',
    proves: 'reviewed',
    requires: ['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified'],
  },
  {
    phase: 'ship',
    agentName: 'gandalf',
    command: 'SHIP.md',
    proves: null,
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
  lens?: ReviewLens
}

export type Dispatched = {
  claudeSessionId: string
  storyId: number
  phase: AgentPhase
  lens?: ReviewLens
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
  forgeCardId?: number
  resumeSessionId?: string
}
