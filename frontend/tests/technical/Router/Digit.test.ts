import { describe, expect, it } from 'vitest'
import { screenOfDigit } from '../../../src/technical/Router/Digit.js'
import { SCREENS } from '../../../src/technical/Router/Screen.js'

describe('screenOfDigit', () => {
  it('mene a l ecran qui porte le chiffre', () => {
    expect(screenOfDigit('1')?.key).toBe('projects')
  })

  it('mene au dernier ecran par son chiffre', () => {
    expect(screenOfDigit('4')?.key).toBe('statistics')
  })

  it('ne mene nulle part sur un chiffre au dela du rail', () => {
    expect(screenOfDigit('5')).toBeNull()
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
    ])
  })

  it('sont tous joignables au clavier', () => {
    for (const screen of SCREENS) {
      expect(screenOfDigit(screen.digit)).toBe(screen)
    }
  })
})
