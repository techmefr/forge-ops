import type { ThemeMode } from '../Theme/Palette.js'

export const MODE_CHOICES = ['dark', 'light', 'system'] as const

export type ModeChoice = (typeof MODE_CHOICES)[number]

export function resolveMode(choice: ModeChoice, prefersDark: boolean): ThemeMode {
  if (choice === 'system') {
    return prefersDark ? 'dark' : 'light'
  }
  return choice
}
