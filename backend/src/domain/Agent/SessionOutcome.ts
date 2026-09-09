import type { AgentLifecycle } from './AgentSession.js'

export const OUTCOME_CLASSES = [
  'succeeded',
  'failed',
  'interrupted',
  'killed',
  'timed_out',
  'budget_exhausted',
  'permission_denied',
  'looping',
  'awaiting_human',
  'runner_missing',
  'unknown',
] as const

export type OutcomeClass = (typeof OUTCOME_CLASSES)[number]

export type SessionExit = {
  exitCode: number | null
  signal?: string
  timedOut?: boolean
  reason?: 'budget' | 'permission' | 'loop' | 'human'
}

export type Outcome = {
  outcome: OutcomeClass
  exitCode: number | null
  statement: string
}

const RUNNER_MISSING_CODE = 127

const STATEMENTS: Record<OutcomeClass, string> = {
  succeeded: 'La session est sortie proprement',
  failed: 'La session est sortie sur une erreur',
  interrupted: 'La session a ete interrompue',
  killed: 'La session a ete tuee sans pouvoir se ranger',
  timed_out: 'La session a depasse le temps qui lui etait laisse',
  budget_exhausted: 'La session a atteint le plafond de cout',
  permission_denied: 'La session a bute sur un refus de permission',
  looping: 'La session tournait en boucle sans progresser',
  awaiting_human: 'La session attend une decision humaine',
  runner_missing: 'Le lanceur de session est introuvable',
  unknown: "La session n'a rendu ni code de sortie ni signal",
}

const REASON_CLASSES: Record<Required<SessionExit>['reason'], OutcomeClass> = {
  budget: 'budget_exhausted',
  permission: 'permission_denied',
  loop: 'looping',
  human: 'awaiting_human',
}

const LIFECYCLES: Record<OutcomeClass, AgentLifecycle> = {
  succeeded: 'finished',
  failed: 'failed',
  interrupted: 'interrupted',
  killed: 'interrupted',
  timed_out: 'failed',
  budget_exhausted: 'failed',
  permission_denied: 'failed',
  looping: 'failed',
  awaiting_human: 'awaiting_human',
  runner_missing: 'failed',
  unknown: 'failed',
}

function classOf(exit: SessionExit): OutcomeClass {
  if (exit.reason !== undefined) {
    return REASON_CLASSES[exit.reason]
  }
  if (exit.timedOut === true) {
    return 'timed_out'
  }
  if (exit.signal === 'SIGKILL') {
    return 'killed'
  }
  if (exit.exitCode === 0) {
    return 'succeeded'
  }
  if (exit.exitCode === RUNNER_MISSING_CODE) {
    return 'runner_missing'
  }
  if (exit.signal !== undefined) {
    return 'interrupted'
  }
  if (exit.exitCode === null) {
    return 'unknown'
  }
  return 'failed'
}

export function classifyOutcome(exit: SessionExit): Outcome {
  const outcome = classOf(exit)
  return { outcome, exitCode: exit.exitCode, statement: STATEMENTS[outcome] }
}

export function lifecycleOfOutcome(outcome: OutcomeClass): AgentLifecycle {
  return LIFECYCLES[outcome]
}
