import { screenOfLetter } from './Letter.js'

export const LEADER = 'g'

export type Stroke = {
  key: string
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

export type StrokeAnswer = {
  path: string | null
  armed: boolean
}

const NOTHING: StrokeAnswer = { path: null, armed: false }

function bare(stroke: Stroke): boolean {
  return !stroke.altKey && !stroke.ctrlKey && !stroke.metaKey
}

export function resolveStroke(stroke: Stroke, armed: boolean): StrokeAnswer {
  if (stroke.altKey && stroke.shiftKey && !stroke.ctrlKey && !stroke.metaKey) {
    const direct = screenOfLetter(stroke.key)
    return direct === null ? NOTHING : { path: direct.path, armed: false }
  }
  if (!bare(stroke)) {
    return NOTHING
  }
  if (armed) {
    const wanted = screenOfLetter(stroke.key)
    return wanted === null ? NOTHING : { path: wanted.path, armed: false }
  }
  return stroke.key.toLowerCase() === LEADER ? { path: null, armed: true } : NOTHING
}
