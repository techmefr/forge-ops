export const PILOT_PACE_SEQUENCE = ['live', 'slow', 'step'] as const

export type PilotPace = (typeof PILOT_PACE_SEQUENCE)[number]

export const PILOT_STEP_KIND_SEQUENCE = ['goto', 'click', 'fill', 'expectText', 'screenshot'] as const

export type PilotStepKind = (typeof PILOT_STEP_KIND_SEQUENCE)[number]

export type PilotStep = {
  kind: PilotStepKind
  target?: string
  value?: string
}

export type PilotOutcome = 'passed' | 'failed'

export type PilotAct = {
  id: number
  position: number
  kind: PilotStepKind
  target: string | null
  value: string | null
  outcome: PilotOutcome
  detail: string
  screenshotPath: string | null
  actedAt: string
}

export const PILOT_RUN_STATE_SEQUENCE = [
  'running',
  'paused',
  'passed',
  'failed',
  'abandoned',
] as const

export type PilotRunState = (typeof PILOT_RUN_STATE_SEQUENCE)[number]

export type PilotRun = {
  id: number
  storyId: number
  storyReference: string
  url: string
  pace: PilotPace
  state: PilotRunState
  position: number
  script: readonly PilotStep[]
  acts: readonly PilotAct[]
  startedAt: string
  endedAt: string | null
}

export type PilotObservation = {
  detail: string
  screenshotPath: string | null
  consoleErrors: readonly string[]
}

export const PARCOURS_REASON_SEQUENCE = [
  'noWorktree',
  'noCriteria',
  'onePerCriterion',
] as const

export type ParcoursReason = (typeof PARCOURS_REASON_SEQUENCE)[number]

export type ParcoursSuggestion = {
  url: string
  script: readonly PilotStep[]
  reason: ParcoursReason
  references: readonly string[]
}
