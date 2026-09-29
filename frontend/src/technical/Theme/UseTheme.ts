import { computed, ref, watchEffect, type Ref } from 'vue'
import {
  DEFAULT_MODE_CHOICE,
  MODE_CHOICES,
  resolveMode,
  type ModeChoice,
} from '../Appearance/ModeChoice.js'
import { readPreference, writePreference } from '../Appearance/Preference.js'
import type { Palette, ThemeMode, ThemeName } from './Palette.js'
import { PALETTE_CACHE_KEY, paletteSignature } from './PrePaint.js'
import { DEFAULT_THEME, THEME_NAMES, paletteVariables, resolvePalette } from './Palette.js'

const THEME_STORAGE_KEY = 'forge.theme'

const MODE_STORAGE_KEY = 'forge.mode'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const theme = ref<ThemeName>(DEFAULT_THEME)

const choice = ref<ModeChoice>(DEFAULT_MODE_CHOICE)

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
    theme.value = readPreference(THEME_STORAGE_KEY, THEME_NAMES, DEFAULT_THEME)
    choice.value = readPreference(MODE_STORAGE_KEY, MODE_CHOICES, DEFAULT_MODE_CHOICE)
    watchSystem()
    watchEffect(() => {
      const root = document.documentElement
      const variables = paletteVariables(palette.value)
      for (const [name, value] of Object.entries(variables)) {
        root.style.setProperty(name, value)
      }
      writePreference(
        PALETTE_CACHE_KEY,
        JSON.stringify({
          signature: paletteSignature(theme.value, mode.value),
          variables,
        }),
      )
      root.dataset.mode = mode.value
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
