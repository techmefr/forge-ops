import { describe, expect, it } from 'vitest'
import { tintOf } from '../../../src/technical/Ui/Tint.js'

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
