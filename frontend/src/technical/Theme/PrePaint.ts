import type { ThemeMode, ThemeName } from './Palette.js'

export const PALETTE_CACHE_KEY = 'forge.palette'

export function paletteSignature(theme: ThemeName, mode: ThemeMode): string {
  return `${theme}|${mode}`
}
