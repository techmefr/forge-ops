import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { createBoardRouter } from '../../../src/technical/Router/Router.js'
import { SCREENS } from '../../../src/technical/Router/Screen.js'

function router() {
  return createBoardRouter(createMemoryHistory())
}

describe('createBoardRouter', () => {
  it('sert chacun des ecrans du rail', async () => {
    const board = router()

    for (const screen of SCREENS) {
      await board.push(screen.path)
      expect(board.currentRoute.value.matched.length, screen.path).toBeGreaterThan(0)
    }
  })

  it('ouvre sur le premier ecran depuis la racine', async () => {
    const board = router()

    await board.push('/')

    expect(board.currentRoute.value.path).toBe('/story')
  })

  it('renvoie un chemin inconnu vers le premier ecran, sans page blanche', async () => {
    const board = router()

    await board.push('/nawak')

    expect(board.currentRoute.value.path).toBe('/story')
  })

  it('sert les ecrans hors rail', async () => {
    const board = router()

    for (const path of ['/settings', '/login']) {
      await board.push(path)
      expect(board.currentRoute.value.path, path).toBe(path)
    }
  })

  it('renvoie les signalements dans l atelier, ils y sont un onglet', async () => {
    const board = router()

    await board.push('/incidents')

    expect(board.currentRoute.value.path).toBe('/story')
  })

  it('retient la story ouverte dans l url', async () => {
    const board = router()

    await board.push('/story/12')

    expect(board.currentRoute.value.params.id).toBe('12')
  })
})
