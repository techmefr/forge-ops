import { describe, expect, it } from 'vitest'
import { screenOfArrow } from '../../../src/technical/Router/TabRing.js'
import { SCREENS } from '../../../src/technical/Router/Screen.js'

const KEYS = SCREENS.map((screen) => screen.key)

describe('screenOfArrow', () => {
  it('avance d un onglet vers la droite', () => {
    expect(screenOfArrow(SCREENS, KEYS[0] ?? '', 'ArrowRight')?.key).toBe(KEYS[1])
  })

  it('recule d un onglet vers la gauche', () => {
    expect(screenOfArrow(SCREENS, KEYS[1] ?? '', 'ArrowLeft')?.key).toBe(KEYS[0])
  })

  it('boucle au dernier onglet quand on recule depuis le premier', () => {
    expect(screenOfArrow(SCREENS, KEYS[0] ?? '', 'ArrowLeft')?.key).toBe(KEYS[KEYS.length - 1])
  })

  it('boucle au premier onglet quand on avance depuis le dernier', () => {
    expect(screenOfArrow(SCREENS, KEYS[KEYS.length - 1] ?? '', 'ArrowRight')?.key).toBe(KEYS[0])
  })

  it('mene au premier et au dernier onglet, comme une barre d onglets le doit', () => {
    expect(screenOfArrow(SCREENS, KEYS[2] ?? '', 'Home')?.key).toBe(KEYS[0])
    expect(screenOfArrow(SCREENS, KEYS[1] ?? '', 'End')?.key).toBe(KEYS[KEYS.length - 1])
  })

  it('ignore une touche qui n est pas une fleche', () => {
    expect(screenOfArrow(SCREENS, KEYS[0] ?? '', 'Enter')).toBeNull()
  })

  it('part du premier onglet quand on vient d un ecran hors barre', () => {
    expect(screenOfArrow(SCREENS, 'login', 'ArrowRight')?.key).toBe(KEYS[1])
  })

  it('ne mene nulle part sans onglet', () => {
    expect(screenOfArrow([], 'projects', 'ArrowRight')).toBeNull()
  })
})
