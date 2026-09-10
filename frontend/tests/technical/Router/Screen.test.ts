import { describe, expect, it } from 'vitest'
import { HOME_PATH, SCREENS, screenOfPath } from '../../../src/technical/Router/Screen.js'

describe('SCREENS', () => {
  it('couvre les dix etapes du pipeline', () => {
    expect(SCREENS).toHaveLength(10)
  })

  it('separe la lecture des diffs du rendu a l ecran', () => {
    expect(SCREENS.map((screen) => screen.key)).toContain('review')
    expect(SCREENS.map((screen) => screen.key)).toContain('view')
  })

  it('nomme l ecran des fichiers par le projet qu il donne a lire', () => {
    expect(SCREENS.find((screen) => screen.key === 'project')?.path).toBe('/project')
  })

  it('numerote chaque etape une seule fois', () => {
    expect(new Set(SCREENS.map((screen) => screen.n)).size).toBe(SCREENS.length)
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
    expect(HOME_PATH).toBe('/story')
  })
})

describe('screenOfPath', () => {
  it('reconnait un chemin exact', () => {
    expect(screenOfPath('/kanban')?.key).toBe('kanban')
  })

  it('reconnait un chemin enfant, pour que le rail reste allume', () => {
    expect(screenOfPath('/backlog/12')?.key).toBe('backlog')
  })

  it('ne confond pas deux chemins de meme prefixe', () => {
    expect(screenOfPath('/storyboard')).toBeNull()
  })

  it('rend nul sur un ecran hors du rail', () => {
    expect(screenOfPath('/settings')).toBeNull()
  })
})
