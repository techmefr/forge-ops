import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createIdentityRepository,
  type IdentityRepository,
} from '../../../src/domain/Identity/IdentityRepository.js'
import { createOidcApi } from '../../../src/domain/Identity/OidcApi.js'
import { loginOf } from '../../../src/domain/Identity/ExternalIdentity.js'
import { claimsOf, readOidcProviders, type OidcProvider } from '../../../src/technical/Auth/OidcProvider.js'

const ORIGIN = 'https://forge.example.com'
const PASSWORD = 'un mot de passe assez long'
const NOW = Date.UTC(2026, 8, 30, 12, 0, 0)

const google: OidcProvider = readOidcProviders({
  FORGE_OIDC_GOOGLE_CLIENT_ID: 'client',
  FORGE_OIDC_GOOGLE_CLIENT_SECRET: 'secret',
})[0] as OidcProvider

let identities: IdentityRepository

function idToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `x.${body}.y`
}

function fakeGoogle(claims: Record<string, unknown>) {
  return async (_url: string, init: RequestInit): Promise<Response> => {
    const nonce = (globalThis as { __nonce?: string }).__nonce ?? ''
    void init
    const token = idToken({
      aud: 'client',
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 600,
      nonce,
      ...claims,
    })
    return new Response(JSON.stringify({ id_token: token }), { status: 200 })
  }
}

async function signIn(allowedDomains: string[], claims: Record<string, unknown>) {
  const api = createOidcApi({
    identities,
    providers: [google],
    allowedDomains,
    publicOrigin: ORIGIN,
    send: fakeGoogle(claims),
  })
  const start = await api.request('/api/auth/oidc/google/start')
  const location = new URL(start.headers.get('location') ?? '')
  ;(globalThis as { __nonce?: string }).__nonce = location.searchParams.get('nonce') ?? ''
  const state = location.searchParams.get('state') ?? ''
  return api.request(`/api/auth/oidc/google/callback?code=abc&state=${state}`)
}

beforeEach(() => {
  identities = createIdentityRepository(openDatabase(':memory:'))
})

describe('oidc claims', () => {
  const payload = { aud: 'client', nonce: 'n', exp: NOW / 1000 + 60, sub: '1', email: 'A@b.com', email_verified: true }

  it('accepte des claims valides', () => {
    expect(claimsOf(google, { ...payload, iss: 'https://accounts.google.com' }, 'n', NOW).email).toBe('a@b.com')
  })

  it.each([
    ['audience', { aud: 'other' }],
    ['nonce', { nonce: 'other' }],
    ['expiration', { exp: NOW / 1000 - 1 }],
    ['issuer', { iss: 'https://evil.example' }],
    ['email non verifie', { email_verified: false }],
  ])('refuse un mauvais %s', (_label, change) => {
    expect(() => claimsOf(google, { ...payload, iss: 'https://accounts.google.com', ...change }, 'n', NOW)).toThrow()
  })
})

describe('oidc login', () => {
  it('ne propose que les fournisseurs configures', async () => {
    const api = createOidcApi({ identities, providers: [google], allowedDomains: [], publicOrigin: ORIGIN })
    expect(await (await api.request('/api/auth/oidc/providers')).json()).toEqual(['google'])
  })

  it('cree un compte pour un domaine autorise', async () => {
    const answer = await signIn(['acme.com'], { sub: '7', email: 'Jane.Doe@acme.com', email_verified: true, name: 'Jane' })
    expect(answer.headers.get('location')).toBe('/')
    expect(answer.headers.get('set-cookie')).toContain('forge_identity=')
    expect(identities.findUser('jane.doe')?.email).toBe('jane.doe@acme.com')
  })

  it('relie un compte existant par email', async () => {
    identities.enrolUser({ login: 'jane', displayName: 'Jane', password: PASSWORD, role: 'director' })
    identities.changeEmail('jane', 'jane@acme.com')
    const answer = await signIn([], { sub: '7', email: 'jane@acme.com', email_verified: true })
    expect(answer.headers.get('location')).toBe('/')
    expect(identities.findUserByExternalSubject('google:7')?.login).toBe('jane')
  })

  it('refuse un domaine inconnu sans compte', async () => {
    const answer = await signIn(['acme.com'], { sub: '8', email: 'eve@evil.com', email_verified: true })
    expect(answer.headers.get('location')).toBe('/login?oidc=refused')
    expect(identities.countUsers()).toBe(0)
  })

  it('refuse un state rejoue', async () => {
    const api = createOidcApi({ identities, providers: [google], allowedDomains: [], publicOrigin: ORIGIN })
    const answer = await api.request('/api/auth/oidc/google/callback?code=abc&state=forged')
    expect(answer.headers.get('location')).toBe('/login?oidc=refused')
  })

  it('derive un login valide depuis l email', () => {
    expect(loginOf('+Jean_Luc@x.com')).toBe('jean_luc')
  })
})

describe('oidc login from the desktop app', () => {
  async function desktopCallback() {
    const api = createOidcApi({
      identities,
      providers: [google],
      allowedDomains: ['acme.com'],
      publicOrigin: ORIGIN,
      send: fakeGoogle({ sub: '9', email: 'sam@acme.com', email_verified: true }),
    })
    const start = await api.request('/api/auth/oidc/google/start?client=desktop')
    const location = new URL(start.headers.get('location') ?? '')
    ;(globalThis as { __nonce?: string }).__nonce = location.searchParams.get('nonce') ?? ''
    const state = location.searchParams.get('state') ?? ''
    const callback = await api.request(`/api/auth/oidc/google/callback?code=abc&state=${state}`)
    return { api, callback }
  }

  it('rend la main a l app par lien profond sans poser de cookie', async () => {
    const { callback } = await desktopCallback()
    expect(callback.headers.get('location')).toMatch(/^forgeops:\/\/auth\?code=/)
    expect(callback.headers.get('set-cookie')).toBeNull()
  })

  it('echange le code une seule fois contre la session', async () => {
    const { api, callback } = await desktopCallback()
    const code = new URL(callback.headers.get('location') ?? '').searchParams.get('code')
    const exchange = () =>
      api.request('/api/auth/oidc/exchange', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
    const first = await exchange()
    expect(((await first.json()) as { token: string }).token).toHaveLength(64)
    expect((await exchange()).status).toBe(401)
  })

  it('renvoie un refus par lien profond', async () => {
    const api = createOidcApi({ identities, providers: [google], allowedDomains: [], publicOrigin: ORIGIN, send: fakeGoogle({ sub: '1', email: 'x@evil.com', email_verified: true }) })
    const start = await api.request('/api/auth/oidc/google/start?client=desktop')
    const location = new URL(start.headers.get('location') ?? '')
    ;(globalThis as { __nonce?: string }).__nonce = location.searchParams.get('nonce') ?? ''
    const callback = await api.request(`/api/auth/oidc/google/callback?code=abc&state=${location.searchParams.get('state')}`)
    expect(callback.headers.get('location')).toBe('forgeops://auth?error=refused')
  })
})
