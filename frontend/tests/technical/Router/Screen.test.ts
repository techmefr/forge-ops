import { describe, expect, it } from 'vitest'
import {
  ABSORBED_PATHS,
  HOME_PATH,
  SCREENS,
  screenOfPath,
} from '../../../src/technical/Router/Screen.js'

describe('SCREENS', () => {
  it('tient l application en quatre ecrans', () => {
    expect(SCREENS).toHaveLength(4)
    expect(SCREENS.map((screen) => screen.key)).toEqual([
      'projects',
      'personal',
      'settings',
      'statistics',
    ])
  })

  it('range les reglages parmi les ecrans, ils ne sont plus un lien a part', () => {
    expect(SCREENS.find((screen) => screen.key === 'settings')?.path).toBe(
      '/settings',
    )
  })

  it('donne un chiffre, un chemin et un sigle uniques a chaque ecran', () => {
    for (const field of ['digit', 'path', 'tiny'] as const) {
      expect(new Set(SCREENS.map((screen) => screen[field])).size, field).toBe(
        SCREENS.length,
      )
    }
  })

  it('ancre chaque chemin a la racine, sinon le routeur ne le voit pas', () => {
    for (const screen of SCREENS) {
      expect(screen.path.startsWith('/')).toBe(true)
    }
  })

  it('ouvre sur les projets', () => {
    expect(HOME_PATH).toBe('/projects')
  })

  it('range chaque ancien chemin sous un des quatre ecrans', () => {
    for (const [from, to] of Object.entries(ABSORBED_PATHS)) {
      expect(screenOfPath(from), from).toBeNull()
      expect(screenOfPath(to)?.path, to).toBeTruthy()
    }
  })
})

describe('screenOfPath', () => {
  it('reconnait un chemin exact', () => {
    expect(screenOfPath('/projects')?.key).toBe('projects')
  })

  it('reconnait un onglet, pour que l ecran reste allume', () => {
    expect(screenOfPath('/me/resources')?.key).toBe('personal')
  })

  it('ne confond pas deux chemins de meme prefixe', () => {
    expect(screenOfPath('/projectsphere')).toBeNull()
  })

  it('rend nul sur un ecran hors des onglets', () => {
    expect(screenOfPath('/login')).toBeNull()
  })
})
