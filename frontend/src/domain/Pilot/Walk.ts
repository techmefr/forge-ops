import type { PilotRun, PilotStep } from '@/domain/Board/BoardModel'
import { phrase, type Phrase } from '@/technical/Language/Phrase'

export type WalkProgress = {
  done: number
  total: number
  percent: number
}

const LIVE_STATES = ['running', 'paused']

export function progressOf(run: PilotRun | null): WalkProgress {
  if (run === null) {
    return { done: 0, total: 0, percent: 0 }
  }
  const total = run.script.length
  return {
    done: run.position,
    total,
    percent: total === 0 ? 0 : Math.round((run.position / total) * 100),
  }
}

export function nextStepOf(run: PilotRun | null): PilotStep | null {
  if (run === null || !LIVE_STATES.includes(run.state)) {
    return null
  }
  return run.script[run.position] ?? null
}

export function describeStep(step: PilotStep): Phrase {
  const target = step.target ?? ''
  const value = step.value ?? ''
  if (step.kind === 'goto') {
    return phrase('pilot.stepGoto', { target })
  }
  if (step.kind === 'click') {
    return phrase('pilot.stepClick', { target })
  }
  if (step.kind === 'fill') {
    return phrase('pilot.stepFill', { target, value })
  }
  if (step.kind === 'expectText') {
    return phrase('pilot.stepExpectText', { target, value })
  }
  return phrase('pilot.stepScreenshot')
}

export function shotUrlOf(screenshotPath: string): string {
  return `/api/pilots/shots/${screenshotPath.split('/').filter((part) => part !== '').slice(-1)[0] ?? ''}`
}
