import { screenOfDigit } from './Digit.js'

export const LEADER = 'z'
export const IDLE = 0
export const ARMED = 2

export type Stroke = {
  key: string
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

export type Phase = 0 | 1 | 2

export type StrokeAnswer = {
  path: string | null
  phase: Phase
}

const NOTHING: StrokeAnswer = { path: null, phase: IDLE }

function bare(stroke: Stroke): boolean {
  return !stroke.altKey && !stroke.ctrlKey && !stroke.metaKey
}

export function resolveStroke(stroke: Stroke, phase: Phase): StrokeAnswer {
  if (stroke.altKey && stroke.shiftKey && !stroke.ctrlKey && !stroke.metaKey) {
    const direct = screenOfDigit(stroke.key)
    return direct === null ? NOTHING : { path: direct.path, phase: IDLE }
  }
  if (!bare(stroke)) {
    return NOTHING
  }
  if (phase === ARMED) {
    const wanted = screenOfDigit(stroke.key)
    return wanted === null ? NOTHING : { path: wanted.path, phase: IDLE }
  }
  if (stroke.key.toLowerCase() !== LEADER) {
    return NOTHING
  }
  return { path: null, phase: phase === IDLE ? 1 : ARMED }
}
