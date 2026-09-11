import type { StoryState } from '../Story/Story.js'

export type FileTouch = {
  storyReference: string
  storyState: StoryState
  agentName: string | null
}

export type FileMark = 'quiet' | 'planned' | 'created' | 'ready' | 'deleted' | 'merged'

export type FileVerdict = {
  mark: FileMark
  byReferences: readonly string[]
  agentName: string | null
}

export type FileReading = {
  onDisk: boolean
  touches: readonly FileTouch[]
}

export const WORKING_STATES: readonly StoryState[] = [
  'drafting',
  'backlog',
  'architecture',
  'plan_review',
  'building',
  'gating',
  'reviewing',
  'escalated',
]

export const READY_STATES: readonly StoryState[] = ['shipping', 'flagged']

function referencesOf(touches: readonly FileTouch[]): readonly string[] {
  return [...new Set(touches.map((touch) => touch.storyReference))].sort()
}

function agentOf(touches: readonly FileTouch[]): string | null {
  if (referencesOf(touches).length > 1) {
    return null
  }
  const named = [...new Set(touches.map((touch) => touch.agentName))].filter(
    (name): name is string => name !== null,
  )
  return named.length === 1 ? (named[0] ?? null) : null
}

function verdictOf(mark: FileMark, touches: readonly FileTouch[]): FileVerdict {
  return { mark, byReferences: referencesOf(touches), agentName: agentOf(touches) }
}

export function markOfFile({ onDisk, touches }: FileReading): FileVerdict {
  if (touches.length === 0) {
    return { mark: 'quiet', byReferences: [], agentName: null }
  }

  const working = touches.filter((touch) => WORKING_STATES.includes(touch.storyState))
  if (working.length > 0) {
    return verdictOf(onDisk ? 'planned' : 'created', working)
  }

  const ready = touches.filter((touch) => READY_STATES.includes(touch.storyState))
  if (ready.length > 0) {
    return verdictOf('ready', ready)
  }

  return verdictOf(onDisk ? 'merged' : 'deleted', touches)
}
