import { createI18n } from 'vue-i18n'
import { readPreference } from '../Appearance/Preference.js'
import {
  FALLBACK_LANGUAGE,
  LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  frenchPluralIndex,
  negotiateLanguage,
  type Language,
} from './Language.js'
import { MESSAGES } from './Locale/Locales.js'

export const DATETIME_FORMATS: Readonly<Record<string, Intl.DateTimeFormatOptions>> = {
  dayTime: { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' },
  full: { dateStyle: 'long', timeStyle: 'short' },
}

function formatsOfEveryLanguage(): Record<string, typeof DATETIME_FORMATS> {
  return Object.fromEntries(LANGUAGES.map((language) => [language, DATETIME_FORMATS]))
}

export function browserLanguages(): readonly string[] {
  try {
    return [...window.navigator.languages]
  } catch {
    return []
  }
}

export function createBoardI18n(locale: Language) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: FALLBACK_LANGUAGE,
    messages: MESSAGES,
    datetimeFormats: formatsOfEveryLanguage(),
    pluralRules: { fr: frenchPluralIndex },
    missingWarn: false,
    fallbackWarn: false,
  })
}

export function initialLanguage(): Language {
  const wanted = negotiateLanguage(browserLanguages())
  return readPreference(LANGUAGE_STORAGE_KEY, LANGUAGES, wanted)
}

export const boardI18n = createBoardI18n(initialLanguage())
