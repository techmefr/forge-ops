import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createIdentityRepository,
  type IdentityRepository,
} from '../../../src/domain/Identity/IdentityRepository.js'
import { createIdentityApi } from '../../../src/domain/Identity/IdentityApi.js'
import { LastSuperAdminError } from '../../../src/domain/Identity/IdentityViolation.js'

let db: Database.Database
let identities: IdentityRepository
let api: Hono

const MOT_DE_PASSE = 'un mot de passe assez long'
const AUTRE_MOT_DE_PASSE = 'un autre mot de passe long'

beforeEach(() => {
  db = openDatabase(':memory:')
  identities = createIdentityRepository(db)
  api = createIdentityApi({ identities, allowEnrolment: () => false })
})

function enrol(login: string): void {
  identities.enrolUser({ login, displayName: login, password: MOT_DE_PASSE, role: 'architect' })
}

function patch(login: string, body: unknown, token?: string): Promise<Response> {
  return api.request(`/api/board-users/${login}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { 'x-forge-identity': token }),
    },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

function tokenOf(login: string): string {
  return identities.openSession(login, MOT_DE_PASSE).token
}

describe('bootstrapSuperAdmin', () => {
  it('cree le compte avec le drapeau quand le login n existe pas', () => {
    const user = identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })

    expect(user).toMatchObject({ login: 'root', superAdmin: true })
    expect(identities.openSession('root', MOT_DE_PASSE).user.superAdmin).toBe(true)
  })

  it('redonne le drapeau a un compte existant sans toucher a son mot de passe', () => {
    enrol('root')

    identities.bootstrapSuperAdmin({ login: 'root', password: AUTRE_MOT_DE_PASSE })

    expect(identities.findUser('root')?.superAdmin).toBe(true)
    expect(() => identities.openSession('root', MOT_DE_PASSE)).not.toThrow()
    expect(() => identities.openSession('root', AUTRE_MOT_DE_PASSE)).toThrow()
  })

  it('reactive un compte desactive avec le drapeau, sinon le super admin configure ne peut plus entrer', () => {
    enrol('root')
    enrol('other')
    identities.changeActive('root', false)

    const user = identities.bootstrapSuperAdmin({ login: 'root', password: AUTRE_MOT_DE_PASSE })

    expect(user.active).toBe(true)
    expect(identities.findUser('root')).toMatchObject({ superAdmin: true, active: true })
    expect(() => identities.openSession('root', MOT_DE_PASSE)).not.toThrow()
  })

  it('ne change rien au deuxieme demarrage', () => {
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })

    expect(identities.countUsers()).toBe(1)
    expect(identities.countSuperAdmins()).toBe(1)
  })

  it('garde un mot de passe change dans l outil apres un redemarrage', () => {
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })
    identities.changePassword('root', MOT_DE_PASSE, AUTRE_MOT_DE_PASSE)

    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })

    expect(() => identities.openSession('root', AUTRE_MOT_DE_PASSE)).not.toThrow()
  })
})

describe('les comptes ordinaires', () => {
  it('ne sont pas super admin par defaut', () => {
    enrol('gaetan')

    expect(identities.findUser('gaetan')?.superAdmin).toBe(false)
  })
})

describe('changeSuperAdmin', () => {
  it('accorde puis retire le drapeau', () => {
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })
    enrol('gaetan')

    identities.changeSuperAdmin('gaetan', true)
    expect(identities.findUser('gaetan')?.superAdmin).toBe(true)

    identities.changeSuperAdmin('gaetan', false)
    expect(identities.findUser('gaetan')?.superAdmin).toBe(false)
  })

  it('refuse de retirer le drapeau au dernier super admin', () => {
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })

    expect(() => identities.changeSuperAdmin('root', false)).toThrow(LastSuperAdminError)
    expect(identities.findUser('root')?.superAdmin).toBe(true)
  })

  it('ne compte pas un super admin desactive comme un recours', () => {
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })
    enrol('gaetan')
    identities.changeSuperAdmin('gaetan', true)
    identities.disableUser('gaetan')

    expect(() => identities.changeSuperAdmin('root', false)).toThrow(LastSuperAdminError)
  })
})

describe('PATCH /api/board-users/:login', () => {
  it('laisse un super admin accorder le drapeau', async () => {
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })
    enrol('gaetan')

    const response = await patch('gaetan', { superAdmin: true }, tokenOf('root'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ login: 'gaetan', superAdmin: true })
  })

  it('refuse en 403 quiconque n est pas super admin', async () => {
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })
    enrol('gaetan')
    enrol('autre')

    const response = await patch('autre', { superAdmin: true }, tokenOf('gaetan'))

    expect(response.status).toBe(403)
    expect(identities.findUser('autre')?.superAdmin).toBe(false)
  })

  it('refuse en 401 sans session', async () => {
    enrol('gaetan')

    const response = await patch('gaetan', { superAdmin: true })

    expect(response.status).toBe(401)
  })

  it('refuse en 409 avec un message clair de retirer le dernier super admin', async () => {
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })

    const response = await patch('root', { superAdmin: false }, tokenOf('root'))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'LastSuperAdminError' })
  })

  it('refuse un corps invalide', async () => {
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })

    const response = await patch('root', { superAdmin: 'oui' }, tokenOf('root'))

    expect(response.status).toBe(422)
  })
})

describe('GET /api/auth/me', () => {
  it('dit si le compte est super admin', async () => {
    identities.bootstrapSuperAdmin({ login: 'root', password: MOT_DE_PASSE })

    const response = await api.request('/api/auth/me', {
      headers: { 'x-forge-identity': tokenOf('root') },
    })

    await expect(response.json()).resolves.toMatchObject({ superAdmin: true })
  })
})
