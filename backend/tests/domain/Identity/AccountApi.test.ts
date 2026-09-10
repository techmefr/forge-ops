import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createIdentityRepository,
  type IdentityRepository,
} from '../../../src/domain/Identity/IdentityRepository.js'
import { createIdentityApi } from '../../../src/domain/Identity/IdentityApi.js'

let db: Database.Database
let identities: IdentityRepository
let api: Hono
let session: string

const PASSWORD = 'un mot de passe assez long'
const NEXT_PASSWORD = 'un autre mot de passe long'

function call(path: string, method: string, body?: unknown, token = session): Promise<Response> {
  return api.request(path, {
    method,
    headers: { 'content-type': 'application/json', 'x-forge-identity': token },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  db = openDatabase(':memory:')
  identities = createIdentityRepository(db)
  api = createIdentityApi({ identities, allowEnrolment: () => true })
  identities.enrolUser({
    login: 'gaetan',
    displayName: 'Gaetan',
    password: PASSWORD,
    role: 'director',
  })
  session = identities.openSession('gaetan', PASSWORD).token
})

describe('GET /api/auth/me', () => {
  it('names the account behind the session', async () => {
    const response = await call('/api/auth/me', 'GET')
    expect(await response.json()).toMatchObject({ login: 'gaetan', role: 'director', email: null })
  })

  it('refuses without a session', async () => {
    expect((await call('/api/auth/me', 'GET', undefined, '')).status).toBe(401)
  })

  it('refuses a session already closed', async () => {
    identities.closeSession(session)
    expect((await call('/api/auth/me', 'GET')).status).toBe(401)
  })

  it('never hands out the password condensate', async () => {
    const response = await call('/api/auth/me', 'GET')
    expect(JSON.stringify(await response.json())).not.toContain('scrypt')
  })
})

describe('PUT /api/auth/profile', () => {
  it('records the address', async () => {
    const response = await call('/api/auth/profile', 'PUT', { email: 'gaetan@example.com' })
    expect(response.status).toBe(200)
    expect(identities.findUser('gaetan')?.email).toBe('gaetan@example.com')
  })

  it('records the name shown', async () => {
    await call('/api/auth/profile', 'PUT', { displayName: 'Gaetan C' })
    expect(identities.findUser('gaetan')?.displayName).toBe('Gaetan C')
  })

  it('refuses an address that is not one', async () => {
    expect((await call('/api/auth/profile', 'PUT', { email: 'pas une adresse' })).status).toBe(422)
  })

  it('refuses an address worn by another account', async () => {
    identities.enrolUser({
      login: 'autre',
      displayName: 'Autre',
      password: PASSWORD,
      role: 'architect',
    })
    identities.changeEmail('autre', 'shared@example.com')
    expect((await call('/api/auth/profile', 'PUT', { email: 'shared@example.com' })).status).toBe(409)
  })

  it('refuses without a session', async () => {
    expect(
      (await call('/api/auth/profile', 'PUT', { email: 'a@example.com' }, '')).status,
    ).toBe(401)
  })

  it('refuses a body that changes nothing', async () => {
    expect((await call('/api/auth/profile', 'PUT', {})).status).toBe(422)
  })
})

describe('PUT /api/auth/password', () => {
  it('lets the new password open a session', async () => {
    const response = await call('/api/auth/password', 'PUT', {
      current: PASSWORD,
      next: NEXT_PASSWORD,
    })
    expect(response.status).toBe(200)
    expect(identities.openSession('gaetan', NEXT_PASSWORD).user.login).toBe('gaetan')
  })

  it('refuses without the current password', async () => {
    const response = await call('/api/auth/password', 'PUT', {
      current: 'faux mot de passe',
      next: NEXT_PASSWORD,
    })
    expect(response.status).toBe(401)
  })

  it('refuses a new password too short to be one', async () => {
    const response = await call('/api/auth/password', 'PUT', { current: PASSWORD, next: 'court' })
    expect(response.status).toBe(422)
  })

  it('closes the sessions opened before the change', async () => {
    await call('/api/auth/password', 'PUT', { current: PASSWORD, next: NEXT_PASSWORD })
    expect(identities.readSession(session)).toBeNull()
  })

  it('refuses without a session', async () => {
    const response = await call(
      '/api/auth/password',
      'PUT',
      { current: PASSWORD, next: NEXT_PASSWORD },
      '',
    )
    expect(response.status).toBe(401)
  })
})
