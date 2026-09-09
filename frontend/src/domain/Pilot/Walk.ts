import type { PilotRun, PilotStep } from '@/domain/Board/BoardModel'

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

export function describeStep(step: PilotStep): string {
  if (step.kind === 'goto') {
    return `Ouvre ${step.target ?? ''}`
  }
  if (step.kind === 'click') {
    return `Clique sur ${step.target ?? ''}`
  }
  if (step.kind === 'fill') {
    return `Ecrit « ${step.value ?? ''} » dans ${step.target ?? ''}`
  }
  if (step.kind === 'expectText') {
    return `Verifie que ${step.target ?? ''} dit « ${step.value ?? ''} »`
  }
  return 'Capture l ecran'
}
