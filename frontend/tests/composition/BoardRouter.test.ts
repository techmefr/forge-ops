import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { createBoardRouter } from '../../src/composition/BoardRouter.js'
import {
  ABSORBED_PATHS,
  HOME_PATH,
  SCREENS,
} from '../../src/technical/Router/Screen.js'
import {
  PERSONAL_TABS,
  PROJECT_TABS,
} from '../../src/technical/Router/ScreenTab.js'

function router() {
  return createBoardRouter(createMemoryHistory())
}

describe('createBoardRouter', () => {
  it('ne sert que quatre ecrans', () => {
    expect(SCREENS.map((screen) => screen.key)).toEqual([
      'projects',
      'personal',
      'settings',
      'statistics',
    ])
  })

  it('sert chacun des quatre ecrans', async () => {
    const board = router()

    for (const screen of SCREENS) {
      await board.push(screen.path)
      expect(
        board.currentRoute.value.matched.length,
        screen.path,
      ).toBeGreaterThan(0)
    }
  })

  it('ouvre sur les projets depuis la racine', async () => {
    const board = router()

    await board.push('/')

    expect(board.currentRoute.value.path).toBe('/projects/board')
  })

  it('renvoie un chemin inconnu sur l ecran d accueil, sans page blanche', async () => {
    const board = router()

    await board.push('/nawak')

    expect(board.currentRoute.value.path).toBe('/projects/board')
    expect(HOME_PATH).toBe('/projects')
  })

  it('sert chaque onglet des projets', async () => {
    const board = router()

    for (const tab of PROJECT_TABS) {
      await board.push(`/projects/${tab}`)
      expect(board.currentRoute.value.params.tab, tab).toBe(tab)
    }
  })

  it('sert chaque onglet du tableau de bord personnel', async () => {
    const board = router()

    for (const tab of PERSONAL_TABS) {
      await board.push(`/me/${tab}`)
      expect(board.currentRoute.value.params.tab, tab).toBe(tab)
    }
  })

  it('sert les ecrans hors onglets', async () => {
    const board = router()

    for (const path of ['/settings', '/statistics', '/login']) {
      await board.push(path)
      expect(board.currentRoute.value.path, path).toBe(path)
    }
  })

  it('renvoie chaque ancien chemin vers l ecran qui l a absorbe', async () => {
    const board = router()

    for (const [from, to] of Object.entries(ABSORBED_PATHS)) {
      await board.push(from)
      expect(board.currentRoute.value.path, from).toBe(to)
    }
  })

  it('retient la story ouverte, meme depuis l ancien chemin', async () => {
    const board = router()

    await board.push('/me/stories/12')
    expect(board.currentRoute.value.params.id).toBe('12')

    await board.push('/atelier/7')
    expect(board.currentRoute.value.path).toBe('/me/stories/7')
  })
})
