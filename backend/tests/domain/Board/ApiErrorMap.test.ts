import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { mapApiError } from '../../../src/domain/Board/ApiErrorMap.js'
import { GuardrailNotRegisteredError } from '../../../src/technical/Guardrail/GuardrailRegistration.js'

function appThrowing(error: unknown): Hono {
  const app = new Hono()
  app.onError(mapApiError)
  app.get('/boom', () => {
    throw error
  })
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('le mapping des erreurs de l API', () => {
  it('repond 409 avec le message quand le garde-fou n est pas enregistre', async () => {
    const error = new GuardrailNotRegisteredError('hooks absents')

    const response = await appThrowing(error).request('/boom')

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'GuardrailNotRegisteredError', message: error.message })
  })

  it('journalise la pile d une erreur inattendue et repond 500', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const error = new Error('inattendue')

    const response = await appThrowing(error).request('/boom')

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'UnexpectedError' })
    expect(logged).toHaveBeenCalledWith(error.stack)
  })

  it('ne journalise pas une erreur metier', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await appThrowing(new GuardrailNotRegisteredError('x')).request('/boom')

    expect(logged).not.toHaveBeenCalled()
  })
})
