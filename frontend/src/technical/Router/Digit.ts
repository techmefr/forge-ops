import { SCREENS, type Screen } from './Screen.js'

export function screenOfDigit(digit: string): Screen | null {
  if (!/^[0-9]$/.test(digit)) {
    return null
  }
  return SCREENS.find((screen) => screen.digit === digit) ?? null
}
