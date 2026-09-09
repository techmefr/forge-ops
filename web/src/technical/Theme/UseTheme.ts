import { computed, ref, watchEffect } from 'vue'
import type { ThemeMode, ThemeName } from './Palette.js'
import { paletteVariables, resolvePalette } from './Palette.js'

const THEME_STORAGE_KEY = 'forge.theme'

const MODE_STORAGE_KEY = 'forge.mode'

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key)
    return allowed.includes(stored as T) ? (stored as T) : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    return
  }
}

const theme = ref<ThemeName>('volt')

const mode = ref<ThemeMode>('dark')

let started = false

export function useTheme() {
  const palette = computed(() => resolvePalette(theme.value, mode.value))

  if (!started) {
    started = true
    theme.value = readStored(
      THEME_STORAGE_KEY,
      ['volt', 'dracula', 'nord', 'gruvbox', 'tokyo', 'solarized'] as const,
      'volt',
    )
    mode.value = readStored(MODE_STORAGE_KEY, ['dark', 'light'] as const, 'dark')
    watchEffect(() => {
      const root = document.documentElement
      for (const [name, value] of Object.entries(paletteVariables(palette.value))) {
        root.style.setProperty(name, value)
      }
      root.dataset.theme = theme.value
      root.style.colorScheme = mode.value
    })
  }

  function selectTheme(next: ThemeName): void {
    theme.value = next
    writeStored(THEME_STORAGE_KEY, next)
  }

  function selectMode(next: ThemeMode): void {
    mode.value = next
    writeStored(MODE_STORAGE_KEY, next)
  }

  return { theme, mode, palette, selectTheme, selectMode }
}
