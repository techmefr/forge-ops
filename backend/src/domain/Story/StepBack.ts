import { CHECKPOINT_SEQUENCE, type CheckpointName } from '../Checkpoint/Checkpoint.js'
import type { StoryState } from './Story.js'
import {
  AgentStepBackRefusedError,
  StepBackFromDoneError,
  StepBackNotBackwardError,
  StepBackOffPipelineError,
  StepBackReasonRequiredError,
} from './StoryViolation.js'

export const STEP_BACK_TARGETS = [
  'backlog',
  'architecture',
  'plan_review',
  'building',
  'gating',
  'reviewing',
  'shipping',
] as const

export type StepBackTarget = (typeof STEP_BACK_TARGETS)[number]

const PIPELINE: readonly StoryState[] = [...STEP_BACK_TARGETS, 'done']

const PHASE_OPENED_BY_CHECKPOINT: Readonly<Record<CheckpointName, StepBackTarget>> = {
  spec_done: 'architecture',
  arch_done: 'plan_review',
  tests_written: 'building',
  build_done: 'gating',
  verified: 'reviewing',
  reviewed: 'shipping',
}

export type StepBackHand = {
  claudeSessionId?: string | null
  agentName?: string | null
}

export type StepBackDraft = {
  storyId: number
  toState: StepBackTarget
  reason: string
  askedBy: string
  revokedCheckpoints: readonly CheckpointName[]
}

export type StepBackRecord = {
  id: number
  storyId: number
  fromState: StoryState
  toState: StoryState
  reason: string
  askedBy: string
  revokedCheckpoints: readonly CheckpointName[]
  steppedBackAt: string
}

export function assertHumanHand(hand: StepBackHand, decision: string): void {
  const named = hand.claudeSessionId ?? hand.agentName ?? null
  if (named !== null && named !== '') {
    throw new AgentStepBackRefusedError(named, decision)
  }
}

export function assertStepBackReason(reference: string, reason: string): string {
  const stated = reason.trim()
  if (stated === '') {
    throw new StepBackReasonRequiredError(reference)
  }
  return stated
}

export function assertStepBack(reference: string, from: StoryState, to: StepBackTarget): void {
  if (from === 'done') {
    throw new StepBackFromDoneError(reference)
  }
  const origin = PIPELINE.indexOf(from)
  if (origin < 0) {
    throw new StepBackOffPipelineError(reference, from)
  }
  if (PIPELINE.indexOf(to) >= origin) {
    throw new StepBackNotBackwardError(reference, from, to)
  }
}

export function checkpointsAheadOf(state: StepBackTarget): readonly CheckpointName[] {
  const reached = PIPELINE.indexOf(state)
  return CHECKPOINT_SEQUENCE.filter(
    (name) => PIPELINE.indexOf(PHASE_OPENED_BY_CHECKPOINT[name]) > reached,
  )
}
