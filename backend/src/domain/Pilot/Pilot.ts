export type {
  DestinationGuard,
  PilotAct,
  PilotObservation,
  PilotOutcome,
  PilotPace,
  PilotRun,
  PilotDriver,
  PilotRunState,
  PilotStep,
  PilotStepKind,
} from '../../../../contract/PilotContract.js'

import type {
  PilotPace,
  PilotRunState,
  PilotStep,
} from '../../../../contract/PilotContract.js'

export type PilotOrder = {
  storyId: number
  url: string
  pace: PilotPace
  script: readonly PilotStep[]
}

export const LIVE_STATES: readonly PilotRunState[] = ['running', 'paused']
