import { ref, watchEffect, type Ref } from 'vue'
import { readPreference, writePreference } from '../Appearance/Preference.js'
import { LANGUAGES, LANGUAGE_STORAGE_KEY, type Language } from './Language.js'

const language = ref<Language>('fr')

let started = false

export type LanguageDesk = {
  language: Ref<Language>
  selectLanguage: (next: Language) => void
}

export function useLanguage(): LanguageDesk {
  if (!started) {
    started = true
    language.value = readPreference(LANGUAGE_STORAGE_KEY, LANGUAGES, 'fr')
    watchEffect(() => {
      document.documentElement.lang = language.value
    })
  }

  return {
    language,
    selectLanguage: (next) => {
      language.value = next
      writePreference(LANGUAGE_STORAGE_KEY, next)
    },
  }
}
