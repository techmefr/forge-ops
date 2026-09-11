import type { AgentLifecycle, AgentPhase, OutcomeClass } from './AgentContract.js'

export const COST_CAP_CONDUCT_SEQUENCE = ['stop', 'downgrade', 'reroute'] as const

export type CostCapConduct = (typeof COST_CAP_CONDUCT_SEQUENCE)[number]

export type BudgetPolicy = {
  capUsd: number
  conduct: CostCapConduct
  downgradeModel: string
  rerouteBaseUrl: string | null
}

export type BudgetSettings = {
  policy: BudgetPolicy
  spentUsd: number
}

export const ORIGIN_KIND_SEQUENCE = ['sentry', 'user_report', 'idea', 'manual'] as const

export type OriginKind = (typeof ORIGIN_KIND_SEQUENCE)[number]

export const INCIDENT_STATE_SEQUENCE = ['pending', 'accepted', 'refused'] as const

export type IncidentState = (typeof INCIDENT_STATE_SEQUENCE)[number]

export type IncidentOrigin = {
  id: number
  slug: string
  name: string
  kind: OriginKind
}

export type Incident = {
  id: number
  originId: number
  fingerprint: string
  title: string
  detail: string
  occurrences: number
  state: IncidentState
  storyId: number | null
  refusalReason: string | null
}

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

export type MachineSnapshot = {
  cpuPercent: number | null
  memoryUsedMb: number | null
  memoryFreeMb: number | null
  diskPercent: number | null
  loadAverage: number | null
}

export type MachineReading = {
  available: boolean
  reason: string | null
  snapshot: MachineSnapshot | null
}

export const FLEET_JOB_STATE_SEQUENCE = [
  'starting',
  'working',
  'running',
  'busy',
  'idle',
  'paused',
  'finished',
  'failed',
] as const

export type FleetJobState = (typeof FLEET_JOB_STATE_SEQUENCE)[number]

export type FleetJob = {
  id: string
  state: string
  cwd: string | null
  sessionId: string | null
  name: string | null
  intent: string | null
  tokens: number | null
  cliVersion: string | null
  updatedAt: string | null
}

export type Fleet = {
  roster: { supervisorPid: number | null; updatedAt: number | null; workerCount: number } | null
  jobs: readonly FleetJob[]
}
