import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createIdentityRepository,
  type IdentityRepository,
} from '../../../src/domain/Identity/IdentityRepository.js'
import { createIdentityApi } from '../../../src/domain/Identity/IdentityApi.js'
import { AccountDisabledError, LastSuperAdminError } from '../../../src/domain/Identity/IdentityViolation.js'

let db: Database.Database
let identities: IdentityRepository
let api: Hono

const PASSWORD = 'un mot de passe assez long'

beforeEach(() => {
  db = openDatabase(':memory:')
  identities = createIdentityRepository(db)
  api = createIdentityApi({ identities, allowEnrolment: () => false })
  identities.bootstrapSuperAdmin({ login: 'root', password: PASSWORD })
  identities.enrolUser({ login: 'chef', displayName: 'Chef', password: PASSWORD, role: 'director' })
  identities.enrolUser({ login: 'ana', displayName: 'Ana', password: PASSWORD, role: 'architect' })
  identities.enrolUser({ login: 'bob', displayName: 'Bob', password: PASSWORD, role: 'architect' })
})

function tokenOf(login: string): string {
  return identities.openSession(login, PASSWORD).token
}

function call(method: string, path: string, body?: unknown, token?: string): Promise<Response> {
  return api.request(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { 'x-forge-identity': token }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

describe('GET /api/board-users', () => {
  it('lists every account with its activity and capacity, without email or hash', async () => {
    const response = await call('GET', '/api/board-users')
    const listed = (await response.json()) as Record<string, unknown>[]

    expect(response.status).toBe(200)
    expect(listed.map((user) => user.login)).toEqual(['ana', 'bob', 'chef', 'root'])
    expect(listed[0]).toEqual({
      id: expect.any(Number),
      login: 'ana',
      displayName: 'Ana',
      role: 'architect',
      superAdmin: false,
      active: true,
      capacity: null,
    })
  })
})

describe('PATCH /api/board-users/:login active and capacity', () => {
  it('lets a director deactivate then reactivate an account', async () => {
    const chef = tokenOf('chef')

    const off = await call('PATCH', '/api/board-users/ana', { active: false }, chef)
    expect(off.status).toBe(200)
    expect(await off.json()).toMatchObject({ login: 'ana', active: false })

    const on = await call('PATCH', '/api/board-users/ana', { active: true }, chef)
    expect(await on.json()).toMatchObject({ login: 'ana', active: true })
  })

  it('refuses the sign in of a deactivated account and cuts its open sessions', async () => {
    const ana = tokenOf('ana')
    await call('PATCH', '/api/board-users/ana', { active: false }, tokenOf('chef'))

    expect(identities.readSession(ana)).toBeNull()
    expect(() => identities.openSession('ana', PASSWORD)).toThrow(AccountDisabledError)
  })

  it('refuses an architect who tries to deactivate someone', async () => {
    const response = await call('PATCH', '/api/board-users/bob', { active: false }, tokenOf('ana'))

    expect(response.status).toBe(403)
    expect(identities.findUser('bob')?.active).toBe(true)
  })

  it('never deactivates the last active super admin', async () => {
    const response = await call('PATCH', '/api/board-users/root', { active: false }, tokenOf('root'))

    expect(response.status).toBe(409)
    expect(() => identities.changeActive('root', false)).toThrow(LastSuperAdminError)
  })

  it('sets and clears the capacity', async () => {
    const chef = tokenOf('chef')

    const set = await call('PATCH', '/api/board-users/ana', { capacity: 4 }, chef)
    expect(await set.json()).toMatchObject({ capacity: 4 })

    const cleared = await call('PATCH', '/api/board-users/ana', { capacity: null }, chef)
    expect(await cleared.json()).toMatchObject({ capacity: null })
  })

  it('lets an account set its own capacity but not another one', async () => {
    const ana = tokenOf('ana')

    expect((await call('PATCH', '/api/board-users/ana', { capacity: 3 }, ana)).status).toBe(200)
    expect((await call('PATCH', '/api/board-users/bob', { capacity: 3 }, ana)).status).toBe(403)
  })

  it.each([0, -1, 100, 2.5])('refuses the capacity %s', async (capacity) => {
    const response = await call('PATCH', '/api/board-users/ana', { capacity }, tokenOf('chef'))

    expect(response.status).toBe(422)
  })

  it('refuses an empty change and an unknown key', async () => {
    const chef = tokenOf('chef')

    expect((await call('PATCH', '/api/board-users/ana', {}, chef)).status).toBe(422)
    expect((await call('PATCH', '/api/board-users/ana', { role: 'director' }, chef)).status).toBe(422)
  })

  it('keeps the super admin flag for super admins only', async () => {
    expect((await call('PATCH', '/api/board-users/ana', { superAdmin: true }, tokenOf('chef'))).status).toBe(403)
    expect((await call('PATCH', '/api/board-users/ana', { superAdmin: true }, tokenOf('root'))).status).toBe(200)
  })

  it('answers 401 without a session', async () => {
    expect((await call('PATCH', '/api/board-users/ana', { active: false })).status).toBe(401)
  })
})

describe('POST /api/board-users', () => {
  const draft = { login: 'eve', displayName: 'Eve', password: PASSWORD, role: 'architect' }

  it('lets a director add an account that can then sign in', async () => {
    const response = await call('POST', '/api/board-users', draft, tokenOf('chef'))

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ login: 'eve', active: true, capacity: null })
    expect(() => identities.openSession('eve', PASSWORD)).not.toThrow()
  })

  it('refuses an architect', async () => {
    expect((await call('POST', '/api/board-users', draft, tokenOf('ana'))).status).toBe(403)
  })

  it('refuses a login already taken', async () => {
    expect((await call('POST', '/api/board-users', { ...draft, login: 'ana' }, tokenOf('chef'))).status).toBe(409)
  })

  it('refuses a short password', async () => {
    expect((await call('POST', '/api/board-users', { ...draft, password: 'court' }, tokenOf('chef'))).status).toBe(422)
  })
})
