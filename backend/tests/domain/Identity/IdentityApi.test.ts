import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createIdentityRepository,
  type IdentityRepository,
} from '../../../src/domain/Identity/IdentityRepository.js'
import { createIdentityApi } from '../../../src/domain/Identity/IdentityApi.js'
import { createLoginRateLimit } from '../../../src/technical/Auth/LoginRateLimit.js'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../../src/technical/Auth/PasswordHash.js'

let db: Database.Database
let identities: IdentityRepository
let api: Hono
let enrolmentOpen: boolean

const MOT_DE_PASSE = 'un mot de passe assez long'

function post(path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return api.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  db = openDatabase(':memory:')
  identities = createIdentityRepository(db)
  enrolmentOpen = true
  api = createIdentityApi({ identities, allowEnrolment: () => enrolmentOpen })
})

describe('POST /api/auth/enrol', () => {
  it('inscrit le premier compte', async () => {
    const response = await post('/api/auth/enrol', {
      login: 'gaetan',
      displayName: 'Gaetan',
      password: MOT_DE_PASSE,
      role: 'director',
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ login: 'gaetan', role: 'director' })
  })

  it('ne rend jamais le condensat du mot de passe', async () => {
    const response = await post('/api/auth/enrol', {
      login: 'gaetan',
      displayName: 'Gaetan',
      password: MOT_DE_PASSE,
      role: 'director',
    })

    await expect(response.text()).resolves.not.toContain('scrypt')
  })

  it('refuse une inscription quand la porte est fermee', async () => {
    enrolmentOpen = false

    const response = await post('/api/auth/enrol', {
      login: 'gaetan',
      displayName: 'Gaetan',
      password: MOT_DE_PASSE,
      role: 'director',
    })

    expect(response.status).toBe(403)
  })

  it('refuse un identifiant qui n est pas un identifiant', async () => {
    const response = await post('/api/auth/enrol', {
      login: 'Gaetan Compigni',
      displayName: 'Gaetan',
      password: MOT_DE_PASSE,
      role: 'director',
    })

    expect(response.status).toBe(422)
  })

  it('rend un conflit sur un identifiant deja pris', async () => {
    const draft = { login: 'gaetan', displayName: 'Gaetan', password: MOT_DE_PASSE, role: 'director' }
    await post('/api/auth/enrol', draft)

    const response = await post('/api/auth/enrol', draft)

    expect(response.status).toBe(409)
  })

  it('refuses a password the hasher would reject, as an invalid enrolment rather than a crash', async () => {
    const response = await post('/api/auth/enrol', {
      login: 'gaetan',
      displayName: 'Gaetan',
      password: 'court',
      role: 'director',
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: 'InvalidEnrolment' })
  })

  it('holds the enrolment rule at the very length the hasher demands', async () => {
    const response = await post('/api/auth/enrol', {
      login: 'gaetan',
      displayName: 'Gaetan',
      password: 'a'.repeat(PASSWORD_MIN_LENGTH),
      role: 'director',
    })

    expect(response.status).toBe(201)
  })

  it('answers a refused password with an unprocessable entity, never a server error', async () => {
    const response = await api.request('/api/auth/enrol', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        login: 'gaetan',
        displayName: 'Gaetan',
        password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1),
        role: 'director',
      }),
    })

    expect(response.status).toBe(422)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await post('/api/auth/enrol', {
      login: 'gaetan',
      displayName: 'Gaetan',
      password: MOT_DE_PASSE,
      role: 'director',
    })
  })

  it('ouvre la session et pose un cookie que le script ne peut pas lire', async () => {
    const response = await post('/api/auth/login', { login: 'gaetan', password: MOT_DE_PASSE })

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('forge_identity=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict')
  })

  it('ne met jamais le jeton de session dans le corps de la reponse', async () => {
    const response = await post('/api/auth/login', { login: 'gaetan', password: MOT_DE_PASSE })
    const cookie = response.headers.get('set-cookie') ?? ''
    const token = cookie.split('forge_identity=')[1]?.split(';')[0] ?? 'absent'

    await expect(response.text()).resolves.not.toContain(token)
  })

  it('refuse un mot de passe faux en 401', async () => {
    const response = await post('/api/auth/login', { login: 'gaetan', password: 'un autre mot de passe' })

    expect(response.status).toBe(401)
  })

  it('refuse un identifiant inconnu avec le meme 401, sans dire qui existe', async () => {
    const inconnu = await post('/api/auth/login', { login: 'personne', password: MOT_DE_PASSE })
    const faux = await post('/api/auth/login', { login: 'gaetan', password: 'un autre mot de passe' })

    expect(inconnu.status).toBe(faux.status)
    await expect(inconnu.json()).resolves.toEqual(await faux.json())
  })

  it('refuse un corps qui n est pas des identifiants', async () => {
    const response = await post('/api/auth/login', { login: 'gaetan' })

    expect(response.status).toBe(422)
  })
})

describe('POST /api/auth/logout', () => {
  it('ferme la session presentee et efface le cookie', async () => {
    await post('/api/auth/enrol', {
      login: 'gaetan',
      displayName: 'Gaetan',
      password: MOT_DE_PASSE,
      role: 'director',
    })
    const opened = identities.openSession('gaetan', MOT_DE_PASSE)

    const response = await post('/api/auth/logout', undefined, { 'x-forge-identity': opened.token })

    expect(response.status).toBe(200)
    expect(identities.readSession(opened.token)).toBeNull()
  })

  it('reste sans erreur quand aucune session n est presentee', async () => {
    const response = await post('/api/auth/logout')

    expect(response.status).toBe(200)
  })

  it('revokes the session the browser carries in its cookie, not only a header', async () => {
    await post('/api/auth/enrol', {
      login: 'gaetan',
      displayName: 'Gaetan',
      password: MOT_DE_PASSE,
      role: 'director',
    })
    const opened = identities.openSession('gaetan', MOT_DE_PASSE)

    const response = await post('/api/auth/logout', undefined, {
      cookie: `forge_identity=${opened.token}`,
    })

    expect(response.status).toBe(200)
    expect(identities.readSession(opened.token)).toBeNull()
  })

  it('clears the browser copy of the cookie as well', async () => {
    await post('/api/auth/enrol', {
      login: 'gaetan',
      displayName: 'Gaetan',
      password: MOT_DE_PASSE,
      role: 'director',
    })
    const opened = identities.openSession('gaetan', MOT_DE_PASSE)

    const response = await post('/api/auth/logout', undefined, {
      cookie: `forge_identity=${opened.token}`,
    })

    expect(response.headers.get('set-cookie')).toContain('forge_identity=')
  })
})

describe('the login rate limit', () => {
  const CAP = 3

  beforeEach(async () => {
    api = createIdentityApi({
      identities,
      allowEnrolment: () => enrolmentOpen,
      loginLimit: createLoginRateLimit({ attemptCap: CAP }),
    })
    await post('/api/auth/enrol', {
      login: 'gaetan',
      displayName: 'Gaetan',
      password: MOT_DE_PASSE,
      role: 'director',
    })
  })

  async function failLogin(times: number): Promise<void> {
    for (let attempt = 0; attempt < times; attempt += 1) {
      await post('/api/auth/login', { login: 'gaetan', password: 'mauvais mot de passe' })
    }
  }

  it('answers too many requests once the allowance is burnt', async () => {
    await failLogin(CAP)

    const response = await post('/api/auth/login', { login: 'gaetan', password: 'mauvais mot de passe' })

    expect(response.status).toBe(429)
  })

  it('shuts the door even on the right password, so guessing gains nothing', async () => {
    await failLogin(CAP)

    const response = await post('/api/auth/login', { login: 'gaetan', password: MOT_DE_PASSE })

    expect(response.status).toBe(429)
  })

  it('says how long the caller must wait', async () => {
    await failLogin(CAP)

    const response = await post('/api/auth/login', { login: 'gaetan', password: MOT_DE_PASSE })

    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('leaves another account alone', async () => {
    await failLogin(CAP)

    const response = await post('/api/auth/login', { login: 'jeremy', password: MOT_DE_PASSE })

    expect(response.status).toBe(401)
  })

  it('still lets the caller in while the allowance is not burnt', async () => {
    await failLogin(CAP - 1)

    const response = await post('/api/auth/login', { login: 'gaetan', password: MOT_DE_PASSE })

    expect(response.status).toBe(200)
  })

  it('forgets the failures of a caller who finally signs in', async () => {
    await failLogin(CAP - 1)
    await post('/api/auth/login', { login: 'gaetan', password: MOT_DE_PASSE })
    await failLogin(CAP - 1)

    const response = await post('/api/auth/login', { login: 'gaetan', password: MOT_DE_PASSE })

    expect(response.status).toBe(200)
  })
})

describe('GET /api/auth/state', () => {
  it('dit combien de comptes existent et si la porte est ouverte', async () => {
    const response = await api.request('/api/auth/state')

    await expect(response.json()).resolves.toEqual({ users: 0, enrolmentOpen: true })
  })
})
