import { describe, expect, it } from 'vitest'
import { textOnTint, tintOf } from '../../../src/technical/Ui/Tint.js'

describe('textOnTint', () => {
  it('reads dark on a light tint', () => {
    expect(textOnTint('#ffee00')).toBe('#141419')
  })

  it('reads light on a dark tint', () => {
    expect(textOnTint('#1a2b66')).toBe('#ffffff')
  })

  it('accepts the short hexadecimal form', () => {
    expect(textOnTint('#fe0')).toBe('#141419')
  })

  it('lets the theme decide for a named colour', () => {
    expect(textOnTint('acc')).toBe('var(--forge-ink)')
  })
})

describe('tintOf', () => {
  it('prend une couleur du theme par son nom', () => {
    expect(tintOf('acc')).toBe('var(--forge-acc)')
  })

  it('garde une couleur ecrite en hexadecimal', () => {
    expect(tintOf('#ff3b00')).toBe('#ff3b00')
  })

  it('garde une couleur ecrite en rgb', () => {
    expect(tintOf('rgb(255, 59, 0)')).toBe('rgb(255, 59, 0)')
  })

  it('retombe sur le trait quand la couleur manque', () => {
    expect(tintOf('   ')).toBe('var(--forge-line)')
  })
})
