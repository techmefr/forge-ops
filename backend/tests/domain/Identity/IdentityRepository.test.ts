import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createIdentityRepository,
  type IdentityRepository,
} from '../../../src/domain/Identity/IdentityRepository.js'
import {
  AccountDisabledError,
  LoginRefusedError,
  LoginTakenError,
  PasswordRefusedError,
} from '../../../src/domain/Identity/IdentityViolation.js'

let db: Database.Database
let identities: IdentityRepository
let now: number

const MOT_DE_PASSE = 'un mot de passe assez long'

beforeEach(() => {
  db = openDatabase(':memory:')
  now = Date.UTC(2026, 8, 9, 12, 0, 0)
  identities = createIdentityRepository(db, { clock: () => now })
})

function enrol(login = 'gaetan'): void {
  identities.enrolUser({ login, displayName: 'Gaetan', password: MOT_DE_PASSE, role: 'architect' })
}

describe('enrolUser', () => {
  it('inscrit un compte et ne rend jamais son condensat', () => {
    const user = identities.enrolUser({
      login: 'gaetan',
      displayName: 'Gaetan',
      password: MOT_DE_PASSE,
      role: 'director',
    })

    expect(user).toEqual({
      id: 1,
      login: 'gaetan',
      displayName: 'Gaetan',
      role: 'director',
      email: null,
    })
  })

  it('refuse deux comptes sur le meme identifiant', () => {
    enrol()

    expect(() => enrol()).toThrow(LoginTakenError)
  })

  it('refuse un mot de passe trop faible', () => {
    expect(() =>
      identities.enrolUser({ login: 'x', displayName: 'X', password: 'court', role: 'architect' }),
    ).toThrow(PasswordRefusedError)
  })

  it('n inscrit rien quand le mot de passe a ete refuse', () => {
    try {
      identities.enrolUser({ login: 'x', displayName: 'X', password: 'court', role: 'architect' })
    } catch {
    }

    expect(identities.countUsers()).toBe(0)
  })
})

describe('openSession', () => {
  it('ouvre une session sur les bons identifiants', () => {
    enrol()

    const opened = identities.openSession('gaetan', MOT_DE_PASSE)

    expect(opened.user.login).toBe('gaetan')
    expect(opened.token.length).toBeGreaterThan(32)
  })

  it('refuse un mot de passe faux', () => {
    enrol()

    expect(() => identities.openSession('gaetan', 'un autre mot de passe')).toThrow(LoginRefusedError)
  })

  it('refuse un identifiant inconnu avec le meme refus, pour ne pas dire qui existe', () => {
    expect(() => identities.openSession('inconnu', MOT_DE_PASSE)).toThrow(LoginRefusedError)
  })

  it('refuse un compte desactive', () => {
    enrol()
    identities.disableUser('gaetan')

    expect(() => identities.openSession('gaetan', MOT_DE_PASSE)).toThrow(AccountDisabledError)
  })

  it('ne garde jamais le jeton de session en clair en base', () => {
    enrol()

    const opened = identities.openSession('gaetan', MOT_DE_PASSE)
    const stored = db.prepare('SELECT token_hash FROM board_session').all() as { token_hash: string }[]

    expect(stored.map((row) => row.token_hash)).not.toContain(opened.token)
  })
})

describe('readSession', () => {
  it('reconnait une session ouverte', () => {
    enrol()
    const opened = identities.openSession('gaetan', MOT_DE_PASSE)

    expect(identities.readSession(opened.token)?.login).toBe('gaetan')
  })

  it('ne reconnait pas un jeton inconnu', () => {
    expect(identities.readSession('nawak')).toBeNull()
  })

  it('ne reconnait plus une session expiree', () => {
    enrol()
    const opened = identities.openSession('gaetan', MOT_DE_PASSE)
    now += 1000 * 60 * 60 * 24 * 31

    expect(identities.readSession(opened.token)).toBeNull()
  })

  it('ne reconnait plus une session revoquee', () => {
    enrol()
    const opened = identities.openSession('gaetan', MOT_DE_PASSE)
    identities.closeSession(opened.token)

    expect(identities.readSession(opened.token)).toBeNull()
  })

  it('ne reconnait plus la session d un compte desactive apres coup', () => {
    enrol()
    const opened = identities.openSession('gaetan', MOT_DE_PASSE)
    identities.disableUser('gaetan')

    expect(identities.readSession(opened.token)).toBeNull()
  })
})

describe('closeSession', () => {
  it('ne touche pas les autres sessions du meme compte', () => {
    enrol()
    const premiere = identities.openSession('gaetan', MOT_DE_PASSE)
    const seconde = identities.openSession('gaetan', MOT_DE_PASSE)

    identities.closeSession(premiere.token)

    expect(identities.readSession(seconde.token)?.login).toBe('gaetan')
  })

  it('reste sans effet sur un jeton inconnu', () => {
    expect(() => identities.closeSession('nawak')).not.toThrow()
  })
})
