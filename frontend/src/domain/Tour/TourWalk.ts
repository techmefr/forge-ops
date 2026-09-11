import { TOUR_STEPS, type TourStep } from './TourStep'

export type TourState = 'pending' | 'running' | 'closed'

export type TourMemory = {
  state: TourState
  index: number
}

export type TourOpening = {
  environment: 'demo' | 'real'
  optIn: boolean
  memory: TourMemory
}

export const TOUR_STATES: readonly TourState[] = ['pending', 'running', 'closed']

export const FIRST_TOUR_MEMORY: TourMemory = { state: 'pending', index: 0 }

export function tourLength(): number {
  return TOUR_STEPS.length
}

export function clampIndex(index: number): number {
  if (!Number.isFinite(index)) {
    return 0
  }
  const last = TOUR_STEPS.length - 1
  return Math.min(Math.max(Math.trunc(index), 0), Math.max(last, 0))
}

export function stepAt(index: number): TourStep | null {
  return TOUR_STEPS[clampIndex(index)] ?? null
}

export function isLastStep(index: number): boolean {
  return clampIndex(index) === TOUR_STEPS.length - 1
}

export function isFirstStep(index: number): boolean {
  return clampIndex(index) === 0
}

export function nextIndex(index: number): number {
  return clampIndex(clampIndex(index) + 1)
}

export function previousIndex(index: number): number {
  return clampIndex(clampIndex(index) - 1)
}

export function shouldOpen({ environment, optIn, memory }: TourOpening): boolean {
  if (TOUR_STEPS.length === 0 || memory.state === 'closed') {
    return false
  }
  return environment === 'demo' || optIn
}

export function readMemory(raw: string | null): TourMemory {
  if (raw === null) {
    return FIRST_TOUR_MEMORY
  }
  const [state, position] = raw.split(':')
  if (!TOUR_STATES.includes(state as TourState)) {
    return FIRST_TOUR_MEMORY
  }
  return { state: state as TourState, index: clampIndex(Number(position)) }
}

export function writeMemory(memory: TourMemory): string {
  return `${memory.state}:${clampIndex(memory.index)}`
}
