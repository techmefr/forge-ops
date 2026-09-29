import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createIdentityRepository,
  type IdentityRepository,
} from '../../../src/domain/Identity/IdentityRepository.js'
import { createIdentityApi } from '../../../src/domain/Identity/IdentityApi.js'
import type * as PasswordHashModule from '../../../src/technical/Auth/PasswordHash.js'
import * as passwordHash from '../../../src/technical/Auth/PasswordHash.js'

vi.mock('../../../src/technical/Auth/PasswordHash.js', async (original) => {
  const actual = await original<typeof PasswordHashModule>()
  return { ...actual, spendVerificationTime: vi.fn(actual.spendVerificationTime) }
})

const PASSWORD = 'un mot de passe assez long'

let identities: IdentityRepository
let api: Hono

function send(method: string, path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return api.request(path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

function tokenOf(login: string): string {
  return identities.openSession(login, PASSWORD).token
}

beforeEach(() => {
  identities = createIdentityRepository(openDatabase(':memory:'))
  identities.bootstrapSuperAdmin({ login: 'root', password: PASSWORD })
  identities.enrolUser({ login: 'dir', displayName: 'Dir', password: PASSWORD, role: 'director' })
  identities.enrolUser({ login: 'ana', displayName: 'Ana', password: PASSWORD, role: 'architect' })
  api = createIdentityApi({ identities, allowEnrolment: () => false })
})

describe('deactivating a super admin', () => {
  it('is refused to a plain director and kept for super admins', async () => {
    identities.enrolUser({ login: 'boss', displayName: 'Boss', password: PASSWORD, role: 'director' })
    identities.changeSuperAdmin('boss', true)

    const refused = await send('PATCH', '/api/board-users/boss', { active: false }, { 'x-forge-identity': tokenOf('dir') })
    const allowed = await send('PATCH', '/api/board-users/boss', { active: false }, { 'x-forge-identity': tokenOf('root') })

    expect(refused.status).toBe(403)
    expect(allowed.status).toBe(200)
  })
})

describe('the login of an unknown account', () => {
  it('costs a password verification like a known one', async () => {
    vi.mocked(passwordHash.spendVerificationTime).mockClear()

    await send('POST', '/api/auth/login', { login: 'ghost', password: PASSWORD })

    expect(passwordHash.spendVerificationTime).toHaveBeenCalledTimes(1)
  })

  it('answers the same as a wrong password', async () => {
    const ghost = await send('POST', '/api/auth/login', { login: 'ghost', password: PASSWORD })
    const wrong = await send('POST', '/api/auth/login', { login: 'ana', password: 'not the password!!' })

    expect(ghost.status).toBe(wrong.status)
    expect(await ghost.json()).toEqual(await wrong.json())
  })
})

describe('the identity cookie', () => {
  it('is httpOnly and strict, and secure behind https', async () => {
    const plain = await send('POST', '/api/auth/login', { login: 'ana', password: PASSWORD })
    const proxied = await send(
      'POST',
      '/api/auth/login',
      { login: 'ana', password: PASSWORD },
      { 'x-forwarded-proto': 'https' },
    )

    const plainCookie = plain.headers.get('set-cookie') ?? ''
    const proxiedCookie = proxied.headers.get('set-cookie') ?? ''
    expect(plainCookie).toContain('HttpOnly')
    expect(plainCookie).toContain('SameSite=Strict')
    expect(plainCookie).not.toContain('Secure')
    expect(proxiedCookie).toContain('Secure')
  })
})

describe('what the account routes hand back', () => {
  it('never carries an email or a hash in the public user list', async () => {
    identities.changeEmail('ana', 'ana@example.com')

    const listed = await api.request('/api/board-users')
    const text = await listed.text()

    expect(text).not.toContain('ana@example.com')
    expect(text).not.toContain('scrypt')
    expect(text).not.toContain('email')
  })

  it('keeps the email to the account it belongs to', async () => {
    identities.changeEmail('ana', 'ana@example.com')

    const own = await api.request('/api/auth/me', { headers: { 'x-forge-identity': tokenOf('ana') } })

    expect(await own.text()).toContain('ana@example.com')
  })
})
