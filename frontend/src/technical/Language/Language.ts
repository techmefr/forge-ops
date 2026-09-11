export const LANGUAGES = ['de', 'en', 'es', 'fr', 'it', 'pt'] as const

export type Language = (typeof LANGUAGES)[number]

export const FALLBACK_LANGUAGE: Language = 'en'

export const LANGUAGE_STORAGE_KEY = 'forge.language'

export function isLanguage(candidate: string): candidate is Language {
  return (LANGUAGES as readonly string[]).includes(candidate)
}

export function negotiateLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0] ?? ''
    if (isLanguage(base)) {
      return base
    }
  }
  return FALLBACK_LANGUAGE
}

export function frenchPluralIndex(count: number, choices: number): number {
  return Math.abs(count) < 2 ? 0 : Math.min(1, choices - 1)
}
