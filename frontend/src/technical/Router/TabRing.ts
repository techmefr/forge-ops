import type { Screen } from './Screen.js'

const STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 }

export function screenOfArrow(
  screens: readonly Screen[],
  current: string,
  key: string,
): Screen | null {
  if (screens.length === 0) {
    return null
  }
  if (key === 'Home') {
    return screens[0] ?? null
  }
  if (key === 'End') {
    return screens[screens.length - 1] ?? null
  }
  const step = STEPS[key]
  if (step === undefined) {
    return null
  }
  const here = screens.findIndex((screen) => screen.key === current)
  const from = here === -1 ? 0 : here
  const wanted = (from + step + screens.length) % screens.length
  return screens[wanted] ?? null
}
