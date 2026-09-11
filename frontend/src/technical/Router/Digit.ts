import { SCREENS, type Screen } from './Screen.js'

export function digitOfStroke(key: string, code?: string): string | null {
  if (/^[0-9]$/.test(key)) {
    return key
  }
  const physical = /^(?:Digit|Numpad)([0-9])$/.exec(code ?? '')
  return physical === null ? null : (physical[1] ?? null)
}

export function screenOfDigit(digit: string): Screen | null {
  if (!/^[0-9]$/.test(digit)) {
    return null
  }
  return SCREENS.find((screen) => screen.digit === digit) ?? null
}
