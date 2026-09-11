import { useI18n } from 'vue-i18n'
import type { Phrase } from './Phrase.js'

export function usePhrase(): (said: Phrase) => string {
  const { t } = useI18n()
  return (said) =>
    said.count === null ? t(said.key, said.values) : t(said.key, said.values, said.count)
}
