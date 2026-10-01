import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const DOMAIN_ROOT = resolve(__dirname, '../../../src/domain')

const FRENCH_WORDS = /\b(le|la|les|des|une|pas|deja|plafond|trop|criteres|sans|est|sont|dans|pour|sur|avec|nom|reglage|depot)\b/i
const FRENCH_ACCENTS = /[àâäéèêëîïôöùûüçœ]/i

function filesNamed(directory: string, suffix: string): readonly string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) {
      return filesNamed(path, suffix)
    }
    return name.endsWith(suffix) ? [path] : []
  })
}

function quotedTexts(source: string): readonly string[] {
  return [...source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])+)\1/g)]
    .map((found) => found[2] ?? '')
    .filter((text) => /\s/.test(text))
}

describe('the messages the board relays to people are written in English', () => {
  const sources = [...filesNamed(DOMAIN_ROOT, 'Violation.ts'), join(DOMAIN_ROOT, 'Story', 'Completeness.ts')]

  for (const path of sources) {
    it(`keeps ${path.slice(DOMAIN_ROOT.length + 1)} free of French wording`, () => {
      const french = quotedTexts(readFileSync(path, 'utf8')).filter(
        (text) => FRENCH_WORDS.test(text) || FRENCH_ACCENTS.test(text),
      )
      expect(french).toEqual([])
    })
  }
})
