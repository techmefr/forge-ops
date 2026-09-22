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

export const RUNNING_AGENT_LIFECYCLES = ['starting', 'working', 'awaiting_human'] as const

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
