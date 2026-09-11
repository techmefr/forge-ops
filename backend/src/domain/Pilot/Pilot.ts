export type {
  PilotAct,
  PilotObservation,
  PilotOutcome,
  PilotPace,
  PilotRun,
  PilotRunState,
  PilotStep,
  PilotStepKind,
} from '../../../../contract/PilotContract.js'

import type {
  PilotObservation,
  PilotPace,
  PilotRunState,
  PilotStep,
} from '../../../../contract/PilotContract.js'

export type PilotDriver = {
  open: (url: string, pace: PilotPace) => Promise<void>
  perform: (step: PilotStep) => Promise<PilotObservation>
  inspect: () => Promise<PilotObservation>
  close: () => Promise<void>
}

export type PilotOrder = {
  storyId: number
  url: string
  pace: PilotPace
  script: readonly PilotStep[]
}

export const LIVE_STATES: readonly PilotRunState[] = ['running', 'paused']
