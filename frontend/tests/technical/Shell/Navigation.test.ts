import { beforeEach, describe, expect, it } from 'vitest'
import {
  NAV_LAYOUTS,
  NAV_LAYOUT_LABELS,
  NAV_STORAGE_KEY,
  readLayout,
  writeLayout,
} from '../../../src/technical/Shell/Navigation.js'

beforeEach(() => {
  window.localStorage.clear()
})

describe('les dispositions de navigation', () => {
  it('propose la barre laterale et les onglets', () => {
    expect([...NAV_LAYOUTS]).toEqual(['rail', 'tabs'])
  })

  it('nomme chaque disposition en francais', () => {
    for (const layout of NAV_LAYOUTS) {
      expect(NAV_LAYOUT_LABELS[layout].length).toBeGreaterThan(2)
    }
  })
})

describe('readLayout', () => {
  it('ouvre sur la barre laterale quand rien n a ete choisi', () => {
    expect(readLayout()).toBe('rail')
  })

  it('retient le choix precedent', () => {
    window.localStorage.setItem(NAV_STORAGE_KEY, 'tabs')

    expect(readLayout()).toBe('tabs')
  })

  it('ignore une valeur qui ne veut rien dire', () => {
    window.localStorage.setItem(NAV_STORAGE_KEY, 'nawak')

    expect(readLayout()).toBe('rail')
  })
})

describe('writeLayout', () => {
  it('garde le choix pour la prochaine visite', () => {
    writeLayout('tabs')

    expect(readLayout()).toBe('tabs')
  })

  it('permet de revenir a la barre laterale', () => {
    writeLayout('tabs')
    writeLayout('rail')

    expect(readLayout()).toBe('rail')
  })
})
