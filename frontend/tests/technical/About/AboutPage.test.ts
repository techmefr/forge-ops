import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const folder = join(process.cwd(), 'frontend', 'public', 'about')
const page = readFileSync(`${folder}/index.html`, 'utf8')
const dictionary = new Function(`const window = {}; ${readFileSync(`${folder}/i18n.js`, 'utf8')}; return window.ABOUT_I18N`)() as Record<
  string,
  Record<string, string>
>

const scrollable = [...page.matchAll(/<(?:pre|div)\b[^>]*\bclass="(?:code|scroll)"[^>]*>/g)].map((match) => match[0])

describe('the about page scrollable regions', () => {
  it('finds the code sample and the comparison table wrapper', () => {
    expect(scrollable).toHaveLength(2)
  })

  it.each(scrollable)('makes %s focusable, with a role and an accessible name', (tag) => {
    expect(tag).toContain('tabindex="0"')
    expect(tag).toContain('role="region"')
    expect(tag).toMatch(/aria-label="[^"]+"/)
    expect(tag).toMatch(/data-i18n-label="k\d+"/)
  })

  it.each(Object.keys(dictionary))('names every scrollable region in %s', (language) => {
    for (const tag of scrollable) {
      const key = /data-i18n-label="(k\d+)"/.exec(tag)?.[1] ?? ''
      expect(dictionary[language]?.[key]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('translates the accessible names into all seven languages', () => {
    expect(Object.keys(dictionary).sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'pt', 'zh'])
  })
})
