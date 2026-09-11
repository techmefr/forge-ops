import { describe, expect, it } from 'vitest'
import { HOME_PATH, SCREENS, screenOfPath } from '../../../src/technical/Router/Screen.js'

describe('SCREENS', () => {
  it('couvre les huit etapes du pipeline', () => {
    expect(SCREENS).toHaveLength(8)
  })

  it('laisse le plan et la review au kanban plutot qu a leur propre ecran', () => {
    const keys = SCREENS.map((screen) => screen.key)
    expect(keys).not.toContain('architecture')
    expect(keys).not.toContain('review')
    expect(keys).toContain('kanban')
    expect(keys).toContain('view')
  })

  it('nomme l ecran des fichiers par le projet qu il donne a lire', () => {
    expect(SCREENS.find((screen) => screen.key === 'project')?.path).toBe('/project')
  })

  it('donne un chiffre unique a chaque etape', () => {
    expect(new Set(SCREENS.map((screen) => screen.digit)).size).toBe(SCREENS.length)
  })

  it('donne un chemin unique a chaque etape', () => {
    expect(new Set(SCREENS.map((screen) => screen.path)).size).toBe(SCREENS.length)
  })

  it('ancre chaque chemin a la racine, sinon le routeur ne le voit pas', () => {
    for (const screen of SCREENS) {
      expect(screen.path.startsWith('/')).toBe(true)
    }
  })

  it('explique a quoi sert chaque ecran', () => {
    for (const screen of SCREENS) {
      expect(screen.sub.length).toBeGreaterThan(20)
    }
  })

  it('ouvre sur la premiere etape', () => {
    expect(HOME_PATH).toBe('/atelier')
  })
})

describe('screenOfPath', () => {
  it('reconnait un chemin exact', () => {
    expect(screenOfPath('/forge')?.key).toBe('kanban')
  })

  it('reconnait un chemin enfant, pour que le rail reste allume', () => {
    expect(screenOfPath('/reserve/12')?.key).toBe('backlog')
  })

  it('ne confond pas deux chemins de meme prefixe', () => {
    expect(screenOfPath('/atelierage')).toBeNull()
  })

  it('rend nul sur un ecran hors du rail', () => {
    expect(screenOfPath('/settings')).toBeNull()
  })
})
