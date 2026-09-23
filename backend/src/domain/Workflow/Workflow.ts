import type { AgentPhase } from '../Agent/AgentSession.js'
import { PHASE_CONTRACTS } from '../Dispatch/Dispatch.js'
import type { WorkflowPhaseEntry } from '../../../../contract/OperationContract.js'

export type { WorkflowPhaseEntry }

export const AGENT_PHASE_SEQUENCE: readonly AgentPhase[] = PHASE_CONTRACTS.map(
  (contract) => contract.phase,
)

export type WorkflowRefusal =
  | { reason: 'UnknownPhase'; phase: string }
  | { reason: 'RepeatedPhase'; phase: string }
  | { reason: 'MissingPhase'; phase: string }
  | { reason: 'EmptyAgentName'; phase: string }
  | { reason: 'EmptyCommand'; phase: string }

export function refusalOf(phases: readonly WorkflowPhaseEntry[]): WorkflowRefusal | null {
  const seen = new Set<string>()
  for (const entry of phases) {
    if (!AGENT_PHASE_SEQUENCE.includes(entry.phase)) {
      return { reason: 'UnknownPhase', phase: entry.phase }
    }
    if (seen.has(entry.phase)) {
      return { reason: 'RepeatedPhase', phase: entry.phase }
    }
    seen.add(entry.phase)
    if (entry.agentName.trim() === '') {
      return { reason: 'EmptyAgentName', phase: entry.phase }
    }
    if (entry.command.trim() === '') {
      return { reason: 'EmptyCommand', phase: entry.phase }
    }
  }
  const missing = AGENT_PHASE_SEQUENCE.find((phase) => !seen.has(phase))
  return missing === undefined ? null : { reason: 'MissingPhase', phase: missing }
}

export const WORKFLOW_CONFIG_KEY = 'workflow.phases'

export const SEED_WORKFLOW: readonly WorkflowPhaseEntry[] = PHASE_CONTRACTS.map((contract) => ({
  phase: contract.phase,
  agentName: contract.agentName,
  command: contract.command,
  preprompt: '',
}))
