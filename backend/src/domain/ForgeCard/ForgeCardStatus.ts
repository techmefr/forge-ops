import type { AgentPhase } from '../Agent/AgentSession.js'
import type { StoryState } from '../Story/Story.js'
import {
  BACKLOG_STEP_KEY,
  DONE_STEP_KEY,
  type ForgeCardStatus,
} from '../../../../contract/ForgeCardContract.js'

export const PHASE_OF_STEP_KEY: Readonly<Record<string, AgentPhase>> = {
  backlog: 'spec',
  architecture: 'architecture',
  building: 'code',
  gating: 'gate',
  reviewing: 'review',
  shipping: 'ship',
}

const PLACEABLE_STATES: readonly StoryState[] = [
  'architecture',
  'plan_review',
  'building',
  'gating',
  'reviewing',
  'shipping',
]

const STATE_OF_CUSTOM_STEP: StoryState = 'building'

export function phaseOfStep(stepKey: string, orderedKeys: readonly string[]): AgentPhase {
  const known = PHASE_OF_STEP_KEY[stepKey]
  if (known !== undefined) {
    return known
  }
  const upTo = orderedKeys.slice(0, Math.max(orderedKeys.indexOf(stepKey), 0))
  for (const key of [...upTo].reverse()) {
    const inherited = PHASE_OF_STEP_KEY[key]
    if (inherited !== undefined) {
      return inherited
    }
  }
  return PHASE_OF_STEP_KEY[BACKLOG_STEP_KEY] ?? 'spec'
}

export function stateOfStep(stepKey: string): StoryState {
  const legacy = PLACEABLE_STATES.find((state) => state === stepKey)
  return legacy ?? STATE_OF_CUSTOM_STEP
}

export type LatestSession = {
  phase: AgentPhase
  lifecycle: string
  outcome: string | null
}

export type StatusInput = {
  stepKey: string
  stepIsHuman: boolean
  currentPhase: AgentPhase
  latest: LatestSession | null
}

const RUNNING_LIFECYCLES: readonly string[] = ['starting', 'working']

export function isRunningLifecycle(lifecycle: string): boolean {
  return RUNNING_LIFECYCLES.includes(lifecycle)
}

export function statusOf({ stepKey, stepIsHuman, currentPhase, latest }: StatusInput): ForgeCardStatus {
  if (stepKey === DONE_STEP_KEY) {
    return 'done'
  }
  if (stepKey === BACKLOG_STEP_KEY) {
    return 'idle'
  }
  const current = latest !== null && latest.phase === currentPhase ? latest : null
  if (current !== null && isRunningLifecycle(current.lifecycle)) {
    return 'running'
  }
  if (stepIsHuman) {
    return 'human_review'
  }
  if (current === null) {
    return 'idle'
  }
  if (current.lifecycle === 'awaiting_human') {
    return 'to_validate'
  }
  if (current.lifecycle === 'finished' && (current.outcome === null || current.outcome === 'succeeded')) {
    return 'to_validate'
  }
  return 'failed'
}
