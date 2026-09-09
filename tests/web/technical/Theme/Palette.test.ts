import { describe, expect, it } from 'vitest'
import {
  ACCENT_KEYS,
  MINIMUM_CONTRAST_RATIO,
  THEME_NAMES,
  contrastRatio,
  mixColours,
  paletteVariables,
  resolvePalette,
} from '../../../../web/src/technical/Theme/Palette.js'

describe('contrastRatio', () => {
  it('gives the extreme ratio for black on white', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
  })

  it('does not depend on the order of the two colours', () => {
    expect(contrastRatio('#D6FF2B', '#0E0E15')).toBeCloseTo(
      contrastRatio('#0E0E15', '#D6FF2B'),
      10,
    )
  })
})

describe('mixColours', () => {
  it('returns the source colour at weight zero', () => {
    expect(mixColours('#D6FF2B', '#FFFFFF', 0)).toBe('#d6ff2b')
  })

  it('returns the target colour at weight one', () => {
    expect(mixColours('#D6FF2B', '#FFFFFF', 1)).toBe('#ffffff')
  })
})

describe('resolvePalette in dark mode', () => {
  it('keeps the surfaces of the requested theme', () => {
    const palette = resolvePalette('volt', 'dark')
    expect(palette.deep).toBe('#07070A')
    expect(palette.card).toBe('#0E0E15')
  })

  it.each(THEME_NAMES)('reaches the minimum contrast on every accent of %s', (name) => {
    const palette = resolvePalette(name, 'dark')
    for (const key of ACCENT_KEYS) {
      expect(contrastRatio(palette[key], palette.card)).toBeGreaterThanOrEqual(
        MINIMUM_CONTRAST_RATIO,
      )
    }
  })
})

describe('resolvePalette in light mode', () => {
  it('turns the panel into the lightest surface and the text into ink', () => {
    const palette = resolvePalette('volt', 'light')
    expect(palette.panel).toBe('#ffffff')
    expect(contrastRatio(palette.txtHi, palette.panel)).toBeGreaterThanOrEqual(7)
  })

  it.each(THEME_NAMES)('reaches the minimum contrast on every accent of %s', (name) => {
    const palette = resolvePalette(name, 'light')
    for (const key of ACCENT_KEYS) {
      expect(contrastRatio(palette[key], palette.panel)).toBeGreaterThanOrEqual(
        MINIMUM_CONTRAST_RATIO,
      )
    }
  })

  it('does not mutate the dark palette of the same theme', () => {
    resolvePalette('volt', 'light')
    expect(resolvePalette('volt', 'dark').panel).toBe('#0C0C12')
  })
})

describe('paletteVariables', () => {
  it('exposes every token as a prefixed custom property', () => {
    const variables = paletteVariables(resolvePalette('volt', 'dark'))
    expect(variables['--forge-acc']).toBe('#D6FF2B')
    expect(variables['--forge-txthi']).toBe('#F4F4F6')
  })
})
