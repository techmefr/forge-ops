import { describe, expect, it } from 'vitest'
import { baseCompile, type CompileError } from '@intlify/message-compiler'
import { LANGUAGES, type Language } from '@/technical/Language/Language'
import { MESSAGES } from '@/technical/Language/Locale/Locales'

type Branch = { [key: string]: string | Branch }

function leaves(branch: Branch, prefix = ""): readonly (readonly [string, string])[] {
  return Object.entries(branch).flatMap(([key, value]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`
    return typeof value === 'string' ? [[path, value] as const] : leaves(value, path)
  })
}

function compileFailures(language: Language): readonly string[] {
  return leaves(MESSAGES[language] as unknown as Branch).flatMap(([path, message]) => {
    try {
      baseCompile(message, { onError: (error: CompileError) => { throw error } })
      return []
    } catch (error) {
      return [`${path}: ${(error as Error).message}`]
    }
  })
}

describe('every locale message compiles with vue-i18n', () => {
  for (const language of LANGUAGES) {
    it(`has no syntax error in ${language}`, () => {
      expect(compileFailures(language)).toEqual([])
    })
  }

  it('keeps the email placeholder literal in every locale', async () => {
    const { createBoardI18n } = await import('@/technical/Language/I18n')
    for (const language of LANGUAGES) {
      expect(createBoardI18n(language).global.t('setting.emailPlaceholder')).toContain('@')
    }
  })
})
