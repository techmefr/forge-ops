import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createIdentityRepository } from '../../../src/domain/Identity/IdentityRepository.js'
import { createPreferenceApi } from '../../../src/domain/Preference/PreferenceApi.js'
import { createPreferenceRepository } from '../../../src/domain/Preference/PreferenceRepository.js'

const PASSWORD = 'un mot de passe assez long'

let db: Database.Database
let app: Hono

function call(method: string, login?: string, body?: unknown): Promise<Response> {
  return app.request('/api/board/preferences', {
    method,
    headers: { 'content-type': 'application/json', ...(login === undefined ? {} : { 'x-login': login }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  db = openDatabase(':memory:')
  const identities = createIdentityRepository(db)
  identities.enrolUser({ login: 'ana', displayName: 'Ana', password: PASSWORD, role: 'architect' })
  identities.enrolUser({ login: 'bob', displayName: 'Bob', password: PASSWORD, role: 'architect' })
  app = new Hono()
  app.use('*', async (context, next) => {
    const login = context.req.header('x-login')
    if (login !== undefined) {
      context.set('login', login)
    }
    await next()
  })
  app.route(
    '/',
    createPreferenceApi({
      preferences: createPreferenceRepository(db),
      userIdOf: (login) => identities.findUser(login)?.id ?? null,
    }),
  )
})

describe('the board preferences of an account', () => {
  it('start empty', async () => {
    expect(await (await call('GET', 'ana')).json()).toEqual({ forgeView: null })
  })

  it('keep the forge view of each account apart', async () => {
    expect((await call('PUT', 'ana', { forgeView: 'pipeline' })).status).toBe(200)

    expect(await (await call('GET', 'ana')).json()).toEqual({ forgeView: 'pipeline' })
    expect(await (await call('GET', 'bob')).json()).toEqual({ forgeView: null })
  })

  it('change when written again', async () => {
    await call('PUT', 'ana', { forgeView: 'pipeline' })
    await call('PUT', 'ana', { forgeView: 'kanban' })

    expect(await (await call('GET', 'ana')).json()).toEqual({ forgeView: 'kanban' })
  })

  it('refuse a view that does not exist', async () => {
    expect((await call('PUT', 'ana', { forgeView: 'gantt' })).status).toBe(422)
  })

  it('are not stored for a caller without an account, who falls back to the browser', async () => {
    expect((await call('PUT', undefined, { forgeView: 'pipeline' })).status).toBe(409)
    expect(await (await call('GET')).json()).toEqual({ forgeView: null })
  })
})
