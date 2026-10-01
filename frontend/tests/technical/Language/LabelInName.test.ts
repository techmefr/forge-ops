import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '@/technical/Language/Language'
import { MESSAGES } from '@/technical/Language/Locale/Locales'

type Branch = { [key: string]: string | Branch }

const PAIRS: readonly (readonly [string, string])[] = [
  ['subjects.row.restore', 'subjects.row.restoreAria'],
  ['subjects.row.release', 'subjects.row.releaseAria'],
  ['followUp.drawer.closeRisk', 'followUp.drawer.closeRiskLabel'],
  ['followUp.drawer.reopenRisk', 'followUp.drawer.reopenRiskLabel'],
]

function lookup(language: (typeof LANGUAGES)[number], path: string): string {
  const found = path.split('.').reduce<string | Branch | undefined>((branch, key) => {
    return typeof branch === 'object' ? branch[key] : undefined
  }, MESSAGES[language] as unknown as Branch)
  if (typeof found !== 'string') {
    throw new Error(`${language}: ${path} is not a string`)
  }
  return found
}

function plain(message: string): string {
  return message.replace(/\{[^}]+\}/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

describe('accessible names contain the visible label', () => {
  describe.each(LANGUAGES)('%s', (language) => {
    it.each(PAIRS)('%s is part of %s', (visible, label) => {
      expect(plain(lookup(language, label))).toContain(plain(lookup(language, visible)))
    })
  })
})
