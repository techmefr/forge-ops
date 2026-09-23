import { computed, ref, watchEffect, type Ref } from 'vue'
import { MODE_CHOICES, resolveMode, type ModeChoice } from '../Appearance/ModeChoice.js'
import { readPreference, writePreference } from '../Appearance/Preference.js'
import type { Palette, ThemeMode, ThemeName } from './Palette.js'
import { THEME_NAMES, paletteVariables, resolvePalette } from './Palette.js'

const THEME_STORAGE_KEY = 'forge.theme'

const MODE_STORAGE_KEY = 'forge.mode'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const theme = ref<ThemeName>('dracula')

const choice = ref<ModeChoice>('dark')

const systemDark = ref(true)

let started = false

export type ThemeDesk = {
  theme: Ref<ThemeName>
  choice: Ref<ModeChoice>
  mode: Ref<ThemeMode>
  palette: Ref<Palette>
  selectTheme: (next: ThemeName) => void
  selectMode: (next: ModeChoice) => void
}

function watchSystem(): void {
  try {
    const query = window.matchMedia(DARK_QUERY)
    systemDark.value = query.matches
    query.addEventListener('change', (event) => {
      systemDark.value = event.matches
    })
  } catch {
    systemDark.value = true
  }
}

export function useTheme(): ThemeDesk {
  const mode = computed(() => resolveMode(choice.value, systemDark.value))
  const palette = computed(() => resolvePalette(theme.value, mode.value))

  if (!started) {
    started = true
    theme.value = readPreference(THEME_STORAGE_KEY, THEME_NAMES, 'dracula')
    choice.value = readPreference(MODE_STORAGE_KEY, MODE_CHOICES, 'dark')
    watchSystem()
    watchEffect(() => {
      const root = document.documentElement
      for (const [name, value] of Object.entries(paletteVariables(palette.value))) {
        root.style.setProperty(name, value)
      }
      root.dataset.theme = theme.value
      root.style.colorScheme = mode.value
    })
  }

  return {
    theme,
    choice,
    mode,
    palette,
    selectTheme: (next) => {
      theme.value = next
      writePreference(THEME_STORAGE_KEY, next)
    },
    selectMode: (next) => {
      choice.value = next
      writePreference(MODE_STORAGE_KEY, next)
    },
  }
}
