import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readPreference, writePreference } from '../../../src/technical/Appearance/Preference.js'

const ALLOWED = ['un', 'deux'] as const

describe('readPreference', () => {
  beforeEach(() => window.localStorage.clear())

  it('rend la valeur gardee', () => {
    window.localStorage.setItem('forge.essai', 'deux')
    expect(readPreference('forge.essai', ALLOWED, 'un')).toBe('deux')
  })

  it('rend le repli quand rien n est garde', () => {
    expect(readPreference('forge.essai', ALLOWED, 'un')).toBe('un')
  })

  it('rend le repli sur une valeur qui n est plus proposee', () => {
    window.localStorage.setItem('forge.essai', 'trois')
    expect(readPreference('forge.essai', ALLOWED, 'un')).toBe('un')
  })

  it('rend le repli quand le stockage est ferme', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('refuse')
    })
    expect(readPreference('forge.essai', ALLOWED, 'un')).toBe('un')
    spy.mockRestore()
  })
})

describe('writePreference', () => {
  beforeEach(() => window.localStorage.clear())

  it('garde la valeur', () => {
    writePreference('forge.essai', 'deux')
    expect(window.localStorage.getItem('forge.essai')).toBe('deux')
  })

  it('se tait quand le stockage refuse', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('refuse')
    })
    expect(() => writePreference('forge.essai', 'deux')).not.toThrow()
    spy.mockRestore()
  })
})
