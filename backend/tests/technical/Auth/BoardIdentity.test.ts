import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { LOCAL_OPERATOR, operatorOf } from '../../../src/technical/Auth/BoardIdentity.js'

function ask(login: string | null): Promise<Response> {
  const api = new Hono()
  api.get('/who', (context) => {
    if (login !== null) {
      context.set('login', login)
    }
    return context.json({ operator: operatorOf(context) })
  })
  return api.request('/who') as Promise<Response>
}

describe('operatorOf', () => {
  it('names the logged in account', async () => {
    await expect((await ask('gaetan')).json()).resolves.toEqual({ operator: 'gaetan' })
  })

  it('falls back to the local operator when no account is logged in', async () => {
    await expect((await ask(null)).json()).resolves.toEqual({ operator: LOCAL_OPERATOR })
  })

  it('falls back on an empty login rather than owning nothing', async () => {
    await expect((await ask('')).json()).resolves.toEqual({ operator: LOCAL_OPERATOR })
  })
})
