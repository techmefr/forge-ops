import type { DefinitionOfDoneStep, ReviewFinding, ReviewPass } from '../Checkpoint/Checkpoint.js'
import { nextLensOf } from '../Checkpoint/ReviewCascade.js'
import { STEP_BACK_TARGETS } from './StepBack.js'
import type { StoryState } from './Story.js'
import { DoneNotEarnedError, StoryNotYoursError } from './StoryViolation.js'

type LastOf<T extends readonly unknown[]> = T extends readonly [...unknown[], infer Last] ? Last : never

export const STATE_BEFORE_DONE = STEP_BACK_TARGETS[
  STEP_BACK_TARGETS.length - 1
] as LastOf<typeof STEP_BACK_TARGETS>

export type DoneReadiness = {
  state: StoryState
  definitionOfDone: readonly DefinitionOfDoneStep[]
  cascade: readonly ReviewPass[]
  unresolvedFindings: readonly ReviewFinding[]
}

export function whatIsMissingForDone(readiness: DoneReadiness): readonly string[] {
  const missing: string[] = []
  if (readiness.state !== STATE_BEFORE_DONE) {
    missing.push(`la story est en ${readiness.state}, on ne clot que depuis ${STATE_BEFORE_DONE}`)
  }
  const unproven = readiness.definitionOfDone.filter((step) => !step.proven).map((step) => step.name)
  if (unproven.length > 0) {
    missing.push(`jalons non prouves : ${unproven.join(', ')}`)
  }
  const waiting = nextLensOf(readiness.cascade)
  if (waiting !== null) {
    missing.push(`la cascade de revue attend encore ${waiting}`)
  }
  const strong = readiness.unresolvedFindings.filter((finding) => finding.severity === 'strong')
  if (strong.length > 0) {
    missing.push(`constats forts non resolus : ${strong.map((finding) => finding.path).join(', ')}`)
  }
  return missing
}

export function assertDoneEarned(reference: string, readiness: DoneReadiness): void {
  const missing = whatIsMissingForDone(readiness)
  if (missing.length > 0) {
    throw new DoneNotEarnedError(reference, missing)
  }
}

export function assertStoryHand(reference: string, assignee: string | null, operator: string): void {
  if (assignee !== null && assignee !== operator) {
    throw new StoryNotYoursError(reference, assignee)
  }
}
