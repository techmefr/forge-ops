import type { TourGesture, TourMove, TourSpot } from '../../../../contract/TourContract'

export type { TourGesture, TourMove, TourSpot }

const TRAVEL_MILLIS: Record<TourGesture, number> = { point: 520, sweep: 900, open: 700 }

const PULSES: Record<TourGesture, number> = { point: 2, sweep: 1, open: 3 }

export function travelMillisOf(gesture: TourGesture, reducedMotion: boolean): number {
  return reducedMotion ? 0 : TRAVEL_MILLIS[gesture]
}

export function pulsesOf(gesture: TourGesture, reducedMotion: boolean): number {
  return reducedMotion ? 0 : PULSES[gesture]
}

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 1
  }
  return Math.min(Math.max(progress, 0), 1)
}

function eased(progress: number): number {
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2
}

function arcOf(move: TourMove, progress: number): number {
  const span = Math.abs(move.to.x - move.from.x) + Math.abs(move.to.y - move.from.y)
  return Math.sin(progress * Math.PI) * Math.min(span / 6, 90)
}

export function spotAt(move: TourMove, progress: number): TourSpot {
  const walked = eased(clampProgress(progress))
  const x = move.from.x + (move.to.x - move.from.x) * walked
  const y = move.from.y + (move.to.y - move.from.y) * walked
  if (move.gesture === 'sweep') {
    return { x, y: y - arcOf(move, clampProgress(progress)) }
  }
  if (move.gesture === 'open') {
    const overshoot = Math.sin(clampProgress(progress) * Math.PI) * 18
    return { x: x + overshoot, y }
  }
  return { x, y }
}

export function centreOf(box: { left: number; top: number; width: number; height: number }): TourSpot {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

export function moveOf(from: TourSpot | null, to: TourSpot, gesture: TourGesture): TourMove {
  return { from: from ?? to, to, gesture }
}

export function travelled(move: TourMove): boolean {
  return move.from.x !== move.to.x || move.from.y !== move.to.y
}

export const AIM_ATTEMPTS = 5

const FIRST_AIM_MILLIS = 120

export function aimDelayOf(attempt: number): number | null {
  if (attempt < 0 || attempt >= AIM_ATTEMPTS) {
    return null
  }
  return FIRST_AIM_MILLIS * Math.pow(2, attempt)
}
