import { describe, expect, it } from 'vitest'
import { HOME_PATH } from '../../../src/technical/Router/Screen.js'
import { PERSONAL_HOME_PATH, resolveLandingPath } from '../../../src/technical/Router/Landing.js'

describe('resolveLandingPath', () => {
  it("envoie vers ma forge quand aucun projet n'existe", async () => {
    await expect(resolveLandingPath(() => Promise.resolve([]))).resolves.toBe(PERSONAL_HOME_PATH)
  })

  it('envoie vers les projets des qu un projet existe', async () => {
    await expect(
      resolveLandingPath(() => Promise.resolve([{ id: 1, slug: 'demo' }])),
    ).resolves.toBe(HOME_PATH)
  })

  it("envoie vers les projets si la reponse n'est pas une liste", async () => {
    await expect(resolveLandingPath(() => Promise.resolve({}))).resolves.toBe(HOME_PATH)
  })

  it('envoie vers les projets si la requete echoue, pour ne jamais bloquer la connexion', async () => {
    await expect(resolveLandingPath(() => Promise.reject(new Error('down')))).resolves.toBe(
      HOME_PATH,
    )
  })
})
