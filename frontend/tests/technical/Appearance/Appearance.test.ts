import { describe, expect, it } from 'vitest'
import {
  FONT_FACES,
  FONT_SCALES,
  fontStackOf,
  rootSizeOf,
} from '../../../src/technical/Appearance/Appearance.js'

describe('les polices proposees', () => {
  it('en offre plusieurs, pas une seule', () => {
    expect(FONT_FACES.length).toBeGreaterThan(2)
  })

  it('donne une pile complete pour chacune, avec un repli', () => {
    for (const face of FONT_FACES) {
      expect(fontStackOf(face).split(',').length).toBeGreaterThan(1)
    }
  })

  it('nomme la police demandee en premier', () => {
    expect(fontStackOf('house').startsWith('"Barlow"')).toBe(true)
  })

  it('retombe sur la pile du systeme pour une police inconnue', () => {
    expect(fontStackOf('comic')).toBe(fontStackOf('system'))
  })
})

describe('les tailles proposees', () => {
  it('vont du plus petit au plus grand', () => {
    const sizes = FONT_SCALES.map((scale) => rootSizeOf(scale))
    expect(sizes).toEqual([...sizes].sort((first, second) => first - second))
  })

  it('garde la taille du navigateur pour la taille normale', () => {
    expect(rootSizeOf('normal')).toBe(16)
  })

  it('reste lisible au plus petit', () => {
    expect(rootSizeOf(FONT_SCALES[0] ?? 'normal')).toBeGreaterThanOrEqual(13)
  })

  it('retombe sur la normale pour une taille inconnue', () => {
    expect(rootSizeOf('enorme')).toBe(16)
  })
})
