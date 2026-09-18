import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createOrganisationRepository } from '../../../src/domain/Organisation/OrganisationRepository.js'
import { createOrganisationApi } from '../../../src/domain/Organisation/OrganisationApi.js'
import type { AuthProvider, InstanceToken, MintedToken } from '../../../src/domain/Organisation/Organisation.js'

let db: Database.Database
let api: Hono
let organisations: ReturnType<typeof createOrganisationRepository>
let admin: boolean

function send(path: string, method: string, body?: unknown): Promise<Response> {
  return api.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }) as Promise<Response>
}

beforeAll(() => {
  db = openDatabase(':memory:')
  organisations = createOrganisationRepository(db)
  api = createOrganisationApi({ organisations, maySettle: () => admin })
})

beforeEach(() => {
  admin = true
})

afterEach(() => {
  db.exec('DELETE FROM instance_token; DELETE FROM auth_provider')
})

describe('the organisation an instance answers for', () => {
  it('writes the sole organisation on first read and keeps it', async () => {
    const response = await send('/api/organisation', 'GET')
    expect(response.status).toBe(200)
    const body = (await response.json()) as { organisation: { id: number; slug: string } }
    expect(body.organisation.slug).toBe('sole')
    expect(organisations.soleOrganisation().id).toBe(body.organisation.id)
  })

  it('offers the password as the way in of a board nobody configured', async () => {
    const body = (await (await send('/api/organisation', 'GET')).json()) as {
      waysIn: readonly string[]
      providers: readonly AuthProvider[]
    }
    expect(body.waysIn).toEqual(['password'])
    expect(body.providers).toHaveLength(4)
  })
})

describe('declaring the providers in the settings', () => {
  it('is refused to anyone but an admin', async () => {
    admin = false
    const response = await send('/api/organisation/providers', 'POST', {
      kind: 'microsoft',
      enabled: true,
      issuer: 'https://login.microsoftonline.com/x',
      clientId: 'abc',
    })
    expect(response.status).toBe(403)
  })

  it('takes a federated provider and lists it as a way in', async () => {
    const response = await send('/api/organisation/providers', 'POST', {
      kind: 'microsoft',
      enabled: true,
      issuer: 'https://login.microsoftonline.com/x',
      clientId: 'abc',
    })
    expect(response.status).toBe(200)
    const body = (await (await send('/api/organisation', 'GET')).json()) as { waysIn: readonly string[] }
    expect(body.waysIn).toEqual(['password', 'microsoft'])
  })

  it('refuses a federated provider without an issuer', async () => {
    const response = await send('/api/organisation/providers', 'POST', {
      kind: 'google',
      enabled: true,
      issuer: null,
      clientId: 'abc',
    })
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ refusal: 'MissingIssuer' })
  })

  it('refuses to close the last way in', async () => {
    const response = await send('/api/organisation/providers', 'POST', {
      kind: 'password',
      enabled: false,
      issuer: null,
      clientId: null,
    })
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ refusal: 'LastWayIn' })
  })
})

describe('the identity of the instance itself', () => {
  it('mints a token that is shown once and never stored in clear', async () => {
    const response = await send('/api/instance/tokens', 'POST', { name: 'le vps' })
    expect(response.status).toBe(201)
    const minted = (await response.json()) as MintedToken
    expect(minted.secret.length).toBeGreaterThan(20)
    const stored = db.prepare('SELECT token_hash FROM instance_token WHERE id = ?').get(minted.token.id)
    expect(stored).not.toMatchObject({ token_hash: minted.secret })
    expect(organisations.identifyToken(minted.secret)?.id).toBe(minted.token.id)
  })

  it('is minted and revoked by an admin alone', async () => {
    admin = false
    expect((await send('/api/instance/tokens', 'POST', { name: 'le vps' })).status).toBe(403)
    admin = true
    const minted = (await (await send('/api/instance/tokens', 'POST', { name: 'le vps' })).json()) as MintedToken
    admin = false
    expect((await send(`/api/instance/tokens/${minted.token.id}`, 'DELETE')).status).toBe(403)
  })

  it('stops answering once revoked', async () => {
    const minted = (await (await send('/api/instance/tokens', 'POST', { name: 'le vps' })).json()) as MintedToken
    const revoked = await send(`/api/instance/tokens/${minted.token.id}`, 'DELETE')
    expect(revoked.status).toBe(200)
    expect(((await revoked.json()) as InstanceToken).revokedAt).not.toBeNull()
    expect(organisations.identifyToken(minted.secret)).toBeNull()
  })

  it('lists the tokens without ever handing the secret back', async () => {
    await send('/api/instance/tokens', 'POST', { name: 'le vps' })
    const listed = (await (await send('/api/instance/tokens', 'GET')).json()) as readonly InstanceToken[]
    expect(listed).toHaveLength(1)
    expect(JSON.stringify(listed)).not.toContain('secret')
  })

  it('answers 404 on a token nobody minted', async () => {
    expect((await send('/api/instance/tokens/9999', 'DELETE')).status).toBe(404)
  })
})
