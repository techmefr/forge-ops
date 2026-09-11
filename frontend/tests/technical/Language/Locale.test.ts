import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LANGUAGES, type Language } from '@/technical/Language/Language'
import { LABEL_GROUPS } from '@/domain/Board/LabelGroup'
import { MESSAGES } from '@/technical/Language/Locale/Locales'

type Branch = { [key: string]: string | Branch }

const DYNAMIC_PREFIXES: readonly string[] = [...Object.keys(LABEL_GROUPS), 'fileSaid']

function sourceRoot(): string {
  let here = process.cwd()
  for (let climbed = 0; climbed < 6; climbed += 1) {
    const candidate = join(here, 'frontend', 'src')
    if (existsSync(candidate)) {
      return candidate
    }
    here = dirname(here)
  }
  throw new Error('frontend/src not found from the working directory')
}

const SOURCE_ROOT = sourceRoot()

function flatten(branch: Branch, prefix = ''): readonly string[] {
  return Object.entries(branch).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return typeof value === 'string' ? [path] : flatten(value, path)
  })
}

function keysOf(language: Language): readonly string[] {
  return [...flatten(MESSAGES[language] as unknown as Branch)].sort()
}

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) {
      return name === 'Locale' ? [] : sourceFiles(path)
    }
    return name.endsWith('.ts') || name.endsWith('.vue') ? [path] : []
  })
}

const SOURCE = sourceFiles(SOURCE_ROOT)
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')

function dynamic(key: string): boolean {
  return DYNAMIC_PREFIXES.some((prefix) => key.startsWith(`${prefix}.`))
}

describe('les six locales portent exactement les memes cles', () => {
  const reference = keysOf('en')

  for (const language of LANGUAGES) {
    it(`ne laisse ni trou ni cle en trop en ${language}`, () => {
      expect(keysOf(language)).toEqual(reference)
    })
  }

  it('couvre les six langues du lot', () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...LANGUAGES].sort())
  })
})

describe('chaque traduction porte du texte', () => {
  for (const language of LANGUAGES) {
    it(`ne laisse aucune chaine vide en ${language}`, () => {
      const blank = flatten(MESSAGES[language] as unknown as Branch).filter((key) => {
        const parts = key.split('.')
        let node: string | Branch = MESSAGES[language] as unknown as Branch
        for (const part of parts) {
          node = (node as Branch)[part] as string | Branch
        }
        return (node as string).trim() === ''
      })
      expect(blank).toEqual([])
    })
  }
})

describe('le francais garde ses accents', () => {
  it('ecrit au moins un mot accentue par groupe de phrases longues', () => {
    const french = JSON.stringify(MESSAGES.fr)
    expect(/[àâäéèêëîïôöùûüçœ]/i.test(french)).toBe(true)
  })

  it('n oublie pas l accent sur les mots du cadre', () => {
    expect(JSON.stringify(MESSAGES.fr)).not.toMatch(/"Reglages"/)
  })
})

const CITED = new Set(
  [
    ...SOURCE.matchAll(/(?:\bt|phrase)\(\s*'([^']+)'/g),
    ...SOURCE.matchAll(/empty-key="([^"]+)"/g),
  ].map((found) => found[1] ?? ''),
)

describe('aucune cle ne dort et aucune cle ne manque', () => {
  it('utilise chaque cle statique quelque part dans le front', () => {
    const asleep = keysOf('en').filter(
      (key) => !dynamic(key) && !CITED.has(key) && !SOURCE.includes(`'${key}'`),
    )
    expect(asleep).toEqual([])
  })

  it('traduit chaque cle citee par le front', () => {
    const known = new Set(keysOf('en'))
    const missing = [...CITED].filter((key) => !known.has(key) && !dynamic(key))
    expect(missing).toEqual([])
  })
})
