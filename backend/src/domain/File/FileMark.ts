import type { StoryState } from '../Story/Story.js'

export type FileTouch = {
  storyReference: string
  storyState: StoryState
  agentName: string | null
}

export type FileMark = 'quiet' | 'planned' | 'created' | 'ready' | 'deleted' | 'merged'

export type FileVerdict = {
  mark: FileMark
  said: string
  byReferences: readonly string[]
}

export type FileReading = {
  onDisk: boolean
  touches: readonly FileTouch[]
}

const WORKING: readonly StoryState[] = [
  'drafting',
  'backlog',
  'architecture',
  'plan_review',
  'building',
  'gating',
  'reviewing',
  'escalated',
]

const READY: readonly StoryState[] = ['shipping', 'flagged']

function referencesOf(touches: readonly FileTouch[]): readonly string[] {
  return [...new Set(touches.map((touch) => touch.storyReference))].sort()
}

function joined(references: readonly string[]): string {
  return references.length === 1 ? (references[0] ?? '') : references.join(' et ')
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

function verdictOf(mark: FileMark, said: string, touches: readonly FileTouch[]): FileVerdict {
  return { mark, said, byReferences: referencesOf(touches) }
}

export function markOfFile({ onDisk, touches }: FileReading): FileVerdict {
  if (touches.length === 0) {
    return { mark: 'quiet', said: '', byReferences: [] }
  }

  const working = touches.filter((touch) => WORKING.includes(touch.storyState))
  if (working.length > 0) {
    const who = joined(referencesOf(working))
    const agent = agentOf(working)
    const verb = referencesOf(working).length === 1 ? 'le modifie' : 'le modifient'
    const said = onDisk
      ? `${who} ${agent === null ? verb : `${verb}, session ${agent}`}`
      : `${who} ${referencesOf(working).length === 1 ? 'le cree' : 'le creent'}`
    return verdictOf(onDisk ? 'planned' : 'created', said, working)
  }

  const ready = touches.filter((touch) => READY.includes(touch.storyState))
  if (ready.length > 0) {
    const who = joined(referencesOf(ready))
    const verb = referencesOf(ready).length === 1 ? 'l a fini' : 'l ont fini'
    return verdictOf('ready', `${who} ${verb}, en attente de merge`, ready)
  }

  const who = joined(referencesOf(touches))
  return onDisk
    ? verdictOf('merged', `${who} l a livre`, touches)
    : verdictOf('deleted', `${who} l a supprime`, touches)
}
