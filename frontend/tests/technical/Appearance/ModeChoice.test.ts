import { describe, expect, it } from 'vitest'
import { MODE_CHOICES, resolveMode } from '../../../src/technical/Appearance/ModeChoice.js'

describe('MODE_CHOICES', () => {
  it('offre le sombre, le clair et le systeme', () => {
    expect([...MODE_CHOICES]).toEqual(['dark', 'light', 'system'])
  })
})

describe('resolveMode', () => {
  it('respecte le sombre demande, meme si le systeme est clair', () => {
    expect(resolveMode('dark', false)).toBe('dark')
  })

  it('respecte le clair demande, meme si le systeme est sombre', () => {
    expect(resolveMode('light', true)).toBe('light')
  })

  it('suit le systeme sombre', () => {
    expect(resolveMode('system', true)).toBe('dark')
  })

  it('suit le systeme clair', () => {
    expect(resolveMode('system', false)).toBe('light')
  })
})
