import { stepVerdictSchema, type StepVerdict } from '../../../../contract/AutopilotContract.js'
import type { EvidenceReader } from '../Evidence/EvidenceRead.js'
import { verdictPathOf } from './StepBrief.js'

export type VerdictReading =
  | { kind: 'found'; verdict: StepVerdict }
  | { kind: 'missing'; path: string }
  | { kind: 'invalid'; path: string; reason: string }

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export function isSafeSegment(segment: string): boolean {
  return SAFE_SEGMENT.test(segment) && !segment.includes('..')
}

export function safeVerdictPath(storyReference: string, stepKey: string): string | null {
  return isSafeSegment(storyReference) && isSafeSegment(stepKey) ? verdictPathOf(storyReference, stepKey) : null
}

export function readVerdict(
  read: EvidenceReader,
  root: string,
  storyReference: string,
  stepKey: string,
): VerdictReading {
  const path = verdictPathOf(storyReference, stepKey)
  if (!isSafeSegment(storyReference) || !isSafeSegment(stepKey)) {
    return { kind: 'invalid', path, reason: 'the story reference or the step key is not a safe path segment' }
  }
  const reading = read(path, root)
  if (reading.kind === 'unreadable') {
    return { kind: 'missing', path }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(reading.content)
  } catch {
    return { kind: 'invalid', path, reason: 'the verdict is not valid JSON' }
  }
  const verdict = stepVerdictSchema.safeParse(parsed)
  if (!verdict.success) {
    return { kind: 'invalid', path, reason: 'the verdict needs a status of pass, fail or blocked' }
  }
  return { kind: 'found', verdict: verdict.data }
}
