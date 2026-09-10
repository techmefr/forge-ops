import { describe, expect, it } from 'vitest'
import { screenOfDigit } from '../../../src/technical/Router/Digit.js'
import { SCREENS } from '../../../src/technical/Router/Screen.js'

describe('screenOfDigit', () => {
  it('mene a l ecran qui porte le chiffre', () => {
    expect(screenOfDigit('1')?.key).toBe('story')
  })

  it('accepte le zero pour le dixieme ecran', () => {
    expect(screenOfDigit('0')?.key).toBe('statistics')
  })

  it('ne mene nulle part sur un chiffre libre', () => {
    expect(screenOfDigit('9')?.key).toBe('resources')
  })

  it('refuse une lettre', () => {
    expect(screenOfDigit('k')).toBeNull()
  })

  it('refuse une touche nommee', () => {
    expect(screenOfDigit('Enter')).toBeNull()
  })

  it('refuse une suite de chiffres', () => {
    expect(screenOfDigit('12')).toBeNull()
  })
})

describe('les chiffres des ecrans', () => {
  it('suivent l ordre de la barre', () => {
    expect(SCREENS.map((screen) => screen.digit)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
    ])
  })

  it('sont tous joignables au clavier', () => {
    for (const screen of SCREENS) {
      expect(screenOfDigit(screen.digit)).toBe(screen)
    }
  })
})
