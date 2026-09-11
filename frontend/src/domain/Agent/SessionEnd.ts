import {
  AGENT_LIFECYCLE_SEQUENCE,
  OUTCOME_CLASSES,
  type AgentLifecycle,
  type OutcomeClass,
} from '@/domain/Board/BoardModel'

function knownOutcome(outcome: string): outcome is OutcomeClass {
  return (OUTCOME_CLASSES as readonly string[]).includes(outcome)
}

function knownLifecycle(lifecycle: string): lifecycle is AgentLifecycle {
  return (AGENT_LIFECYCLE_SEQUENCE as readonly string[]).includes(lifecycle)
}

export function sessionEndKey(outcome: string | null, lifecycle: string): string {
  if (outcome !== null) {
    return knownOutcome(outcome) ? `outcome.${outcome}` : 'outcome.unknown'
  }
  return knownLifecycle(lifecycle) ? `lifecycle.${lifecycle}` : 'outcome.unknown'
}
