import type { ThemeMode } from '../Theme/Palette.js'

export const MODE_CHOICES = ['dark', 'light', 'system'] as const

export type ModeChoice = (typeof MODE_CHOICES)[number]

export const MODE_CHOICE_LABELS: Readonly<Record<ModeChoice, string>> = {
  dark: 'Sombre',
  light: 'Clair',
  system: 'Comme le systeme',
}

export function resolveMode(choice: ModeChoice, prefersDark: boolean): ThemeMode {
  if (choice === 'system') {
    return prefersDark ? 'dark' : 'light'
  }
  return choice
}
