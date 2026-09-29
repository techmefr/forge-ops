import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MODE_CHOICE, resolveMode } from '../../../src/technical/Appearance/ModeChoice.js'
import {
  ACCENT_KEYS,
  DEFAULT_THEME,
  TEXT_KEYS,
  contrastRatio,
  paletteVariables,
  resolvePalette,
  type ThemeMode,
} from '../../../src/technical/Theme/Palette.js'

const NORMAL_TEXT_RATIO = 4.5

const READING_SURFACES = ['deep', 'panel', 'card', 'elev'] as const

const ACCENT_SURFACES = ['panel', 'card'] as const

describe('default appearance', () => {
  it('starts on Dracula', () => {
    expect(DEFAULT_THEME).toBe('dracula')
  })

  it('follows the system until the user chooses', () => {
    expect(DEFAULT_MODE_CHOICE).toBe('system')
  })

  it('resolves to the dark palette when the system prefers dark', () => {
    const mode = resolveMode(DEFAULT_MODE_CHOICE, true)
    expect(resolvePalette(DEFAULT_THEME, mode).card).toBe('#282A36')
  })

  it('resolves to Alucard when the system prefers light', () => {
    const mode = resolveMode(DEFAULT_MODE_CHOICE, false)
    const palette = resolvePalette(DEFAULT_THEME, mode)
    expect(palette.panel).toBe('#FFFBEB')
    expect(palette.acc).toBe('#644AC9')
  })

  it('keeps an explicit choice whatever the system prefers', () => {
    expect(resolveMode('light', true)).toBe('light')
    expect(resolveMode('dark', false)).toBe('dark')
  })
})

describe.each<ThemeMode>(['dark', 'light'])('Dracula contrast in %s mode', (mode) => {
  const palette = resolvePalette('dracula', mode)

  it.each(TEXT_KEYS.flatMap((text) => READING_SURFACES.map((surface) => [text, surface] as const)))(
    '%s reads on %s',
    (text, surface) => {
      expect(contrastRatio(palette[text], palette[surface])).toBeGreaterThanOrEqual(
        NORMAL_TEXT_RATIO,
      )
    },
  )

  it.each(
    ACCENT_KEYS.flatMap((accent) => ACCENT_SURFACES.map((surface) => [accent, surface] as const)),
  )('%s reads on %s', (accent, surface) => {
    expect(contrastRatio(palette[accent], palette[surface])).toBeGreaterThanOrEqual(
      NORMAL_TEXT_RATIO,
    )
  })

  it('keeps the ink readable on the accent', () => {
    expect(contrastRatio(palette.ink, palette.acc)).toBeGreaterThanOrEqual(NORMAL_TEXT_RATIO)
  })
})

describe('first paint', () => {
  const html = readFileSync(resolve(process.cwd(), 'frontend/index.html'), 'utf8')
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''

  function run(store: Record<string, string>, prefersDark: boolean) {
    const properties: Record<string, string> = {}
    const root = {
      dataset: {} as Record<string, string>,
      style: {
        colorScheme: '',
        setProperty: (name: string, value: string) => {
          properties[name] = value
        },
      },
    }
    const environment = {
      document: { documentElement: root },
      window: {
        localStorage: { getItem: (key: string) => store[key] ?? null },
        matchMedia: () => ({ matches: prefersDark }),
      },
    }
    new Function('document', 'window', script)(environment.document, environment.window)
    return { root, properties }
  }

  it('marks the system dark scheme before anything renders', () => {
    const { root } = run({}, true)
    expect(root.dataset.mode).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
  })

  it('marks the system light scheme before anything renders', () => {
    const { root } = run({}, false)
    expect(root.dataset.mode).toBe('light')
  })

  it('lets an explicit mode win over the system', () => {
    const { root } = run({ 'forge.mode': 'dark' }, false)
    expect(root.dataset.mode).toBe('dark')
  })

  it('applies the cached palette when its signature matches', () => {
    const cache = JSON.stringify({
      signature: 'dracula|dark',
      variables: paletteVariables(resolvePalette('dracula', 'dark')),
    })
    const { properties, root } = run({ 'forge.palette': cache }, true)
    expect(properties['--forge-card']).toBe('#282A36')
    expect(root.dataset.theme).toBe('dracula')
  })

  it('ignores a cached palette that belongs to another scheme', () => {
    const cache = JSON.stringify({
      signature: 'dracula|dark',
      variables: paletteVariables(resolvePalette('dracula', 'dark')),
    })
    const { properties } = run({ 'forge.palette': cache }, false)
    expect(properties['--forge-card']).toBeUndefined()
  })

  it('does not throw when the storage is unreachable', () => {
    expect(() =>
      new Function('document', 'window', script)(
        { documentElement: { dataset: {}, style: {} } },
        {
          get localStorage(): never {
            throw new Error('blocked')
          },
        },
      ),
    ).not.toThrow()
  })
})

describe('stylesheet fallback', () => {
  const css = readFileSync(resolve(process.cwd(), 'frontend/src/style.css'), 'utf8').toLowerCase()

  it.each<ThemeMode>(['dark', 'light'])('declares the %s Dracula tokens', (mode) => {
    for (const [name, value] of Object.entries(paletteVariables(resolvePalette('dracula', mode)))) {
      expect(css).toContain(`${name}: ${value.toLowerCase()};`)
    }
  })
})
