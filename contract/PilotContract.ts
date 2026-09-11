export type PilotPace = 'live' | 'slow' | 'step'

export type PilotStepKind = 'goto' | 'click' | 'fill' | 'expectText' | 'screenshot'

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

export type PilotRunState = 'running' | 'paused' | 'passed' | 'failed' | 'abandoned'

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

export type ParcoursSuggestion = {
  url: string
  script: readonly PilotStep[]
  reason: string
}
