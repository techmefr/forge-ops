export const SUPPORTED_LOCALES = ['fr', 'en', 'es', 'pt', 'zh', 'ja', 'ko', 'ar']
export const RTL_LOCALES = ['ar']
export const DEFAULT_LOCALE = 'fr'
const COOKIE_NAME = 'starfleet_locale'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function readCookieLocale() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  if (match === null) {
    return null
  }
  const value = decodeURIComponent(match[1])
  return SUPPORTED_LOCALES.includes(value) ? value : null
}

function detectBrowserLocale() {
  const browserLanguage = navigator.language.slice(0, 2).toLowerCase()
  return SUPPORTED_LOCALES.includes(browserLanguage) ? browserLanguage : null
}

export function detectLocale() {
  return readCookieLocale() ?? detectBrowserLocale() ?? DEFAULT_LOCALE
}

export function persistLocale(locale) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}`
}

export async function loadTranslations(locale) {
  const response = await fetch(`/locales/${locale}.json`)
  return response.json()
}

export function applyDirection(locale) {
  document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'
  document.documentElement.lang = locale
}

export function translate(translations, key) {
  return key.split('.').reduce((node, part) => node?.[part], translations) ?? key
}

export function interpolate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, token) => String(values[token] ?? ''))
}
