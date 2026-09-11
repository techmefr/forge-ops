import { computed, type WritableComputedRef } from 'vue'
import { writePreference } from '../Appearance/Preference.js'
import { boardI18n } from './I18n.js'
import { LANGUAGE_STORAGE_KEY, type Language } from './Language.js'

export type LanguageDesk = {
  language: WritableComputedRef<Language>
  selectLanguage: (next: Language) => void
}

function wear(next: Language): void {
  boardI18n.global.locale.value = next
  try {
    document.documentElement.lang = next
  } catch {
    return
  }
}

export function startLanguage(): void {
  wear(boardI18n.global.locale.value as Language)
}

export function useLanguage(): LanguageDesk {
  const language = computed<Language>({
    get: () => boardI18n.global.locale.value as Language,
    set: (next) => {
      wear(next)
      writePreference(LANGUAGE_STORAGE_KEY, next)
    },
  })

  return {
    language,
    selectLanguage: (next) => {
      language.value = next
    },
  }
}
