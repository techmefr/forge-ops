import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { CONNECT_PATH, createConnectGuard } from '../../../src/technical/Router/ConnectGuard.js'

function to(path: string): RouteLocationNormalized {
  return { path } as RouteLocationNormalized
}

async function run(isDesktop: boolean, isConnected: boolean, path: string): Promise<unknown> {
  const guard = createConnectGuard(isDesktop, () => isConnected)
  return guard(to(path), to('/'), () => undefined)
}

describe('createConnectGuard', () => {
  it('laisse passer le navigateur', async () => {
    expect(await run(false, false, '/projects')).toBe(true)
  })

  it('envoie le desktop sans adresse vers la connexion', async () => {
    expect(await run(true, false, '/projects')).toEqual({ path: CONNECT_PATH })
  })

  it('laisse passer le desktop connecte', async () => {
    expect(await run(true, true, '/projects')).toBe(true)
  })

  it('ne boucle pas sur la page de connexion', async () => {
    expect(await run(true, false, CONNECT_PATH)).toBe(true)
  })
})
