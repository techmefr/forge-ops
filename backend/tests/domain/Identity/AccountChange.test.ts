import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createIdentityRepository,
  type IdentityRepository,
} from '../../../src/domain/Identity/IdentityRepository.js'

let db: Database.Database
let identities: IdentityRepository

const PASSWORD = 'un mot de passe assez long'
const NEXT_PASSWORD = 'un autre mot de passe long'

beforeEach(() => {
  db = openDatabase(':memory:')
  identities = createIdentityRepository(db)
  identities.enrolUser({
    login: 'gaetan',
    displayName: 'Gaetan',
    password: PASSWORD,
    role: 'director',
  })
})

describe('changeEmail', () => {
  it('records the address on the account', () => {
    identities.changeEmail('gaetan', 'gaetan@example.com')
    expect(identities.findUser('gaetan')?.email).toBe('gaetan@example.com')
  })

  it('leaves the address empty until it is set', () => {
    expect(identities.findUser('gaetan')?.email).toBeNull()
  })

  it('replaces an address already recorded', () => {
    identities.changeEmail('gaetan', 'first@example.com')
    identities.changeEmail('gaetan', 'second@example.com')
    expect(identities.findUser('gaetan')?.email).toBe('second@example.com')
  })

  it('refuses an address already worn by someone else', () => {
    identities.enrolUser({
      login: 'autre',
      displayName: 'Autre',
      password: PASSWORD,
      role: 'architect',
    })
    identities.changeEmail('autre', 'shared@example.com')
    expect(() => identities.changeEmail('gaetan', 'shared@example.com')).toThrow(/deja/)
  })

  it('accepts the same address kept unchanged', () => {
    identities.changeEmail('gaetan', 'gaetan@example.com')
    expect(() => identities.changeEmail('gaetan', 'gaetan@example.com')).not.toThrow()
  })

  it('refuses an unknown account', () => {
    expect(() => identities.changeEmail('personne', 'a@example.com')).toThrow()
  })
})

describe('changePassword', () => {
  it('lets the new password open a session', () => {
    identities.changePassword('gaetan', PASSWORD, NEXT_PASSWORD)
    expect(identities.openSession('gaetan', NEXT_PASSWORD).user.login).toBe('gaetan')
  })

  it('closes the old password', () => {
    identities.changePassword('gaetan', PASSWORD, NEXT_PASSWORD)
    expect(() => identities.openSession('gaetan', PASSWORD)).toThrow()
  })

  it('refuses without the current password', () => {
    expect(() => identities.changePassword('gaetan', 'faux mot de passe', NEXT_PASSWORD)).toThrow()
  })

  it('keeps the old password working when the change is refused', () => {
    expect(() => identities.changePassword('gaetan', 'faux mot de passe', NEXT_PASSWORD)).toThrow()
    expect(identities.openSession('gaetan', PASSWORD).user.login).toBe('gaetan')
  })

  it('refuses a new password that is too short', () => {
    expect(() => identities.changePassword('gaetan', PASSWORD, 'court')).toThrow(/caracteres/)
  })

  it('revokes the sessions opened with the old password', () => {
    const opened = identities.openSession('gaetan', PASSWORD)
    identities.changePassword('gaetan', PASSWORD, NEXT_PASSWORD)
    expect(identities.readSession(opened.token)).toBeNull()
  })

  it('refuses an unknown account', () => {
    expect(() => identities.changePassword('personne', PASSWORD, NEXT_PASSWORD)).toThrow()
  })
})

describe('changeDisplayName', () => {
  it('records the name shown on the board', () => {
    identities.changeDisplayName('gaetan', 'Gaetan C')
    expect(identities.findUser('gaetan')?.displayName).toBe('Gaetan C')
  })

  it('refuses an unknown account', () => {
    expect(() => identities.changeDisplayName('personne', 'Qui')).toThrow()
  })
})

