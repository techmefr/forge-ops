import { randomBytes } from 'node:crypto'
import { hashPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../technical/Auth/PasswordHash.js'
import type { BoardUser, ExternalUserDraft, SuperAdminSeed, UserDraft } from './Identity.js'
import type { IdentityLookups } from './IdentityLookups.js'
import { TOKEN_BYTES, toUser } from './IdentityRows.js'
import type { IdentityStatements } from './IdentityStatements.js'
import { EmailTakenError, LoginTakenError, PasswordRefusedError } from './IdentityViolation.js'

export function assertPasswordLength(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new PasswordRefusedError(`il faut au moins ${PASSWORD_MIN_LENGTH} caracteres`)
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new PasswordRefusedError(`il faut au plus ${PASSWORD_MAX_LENGTH} caracteres`)
  }
}

export function createIdentityEnrolment(
  { insertUser, selectUserByLogin, selectUserByEmail, selectVerifiedUserByEmail, insertExternalUser, updateSuperAdmin, reactivateByLogin }: IdentityStatements,
  { demandUser }: Pick<IdentityLookups, 'demandUser'>,
) {
  function enrolUser(draft: UserDraft): BoardUser {
    if (selectUserByLogin.get(draft.login) !== undefined) {
      throw new LoginTakenError(draft.login)
    }
    assertPasswordLength(draft.password)
    const stored = hashPassword(draft.password)
    const info = insertUser.run(draft.login, draft.displayName, stored, draft.role)
    return {
      id: Number(info.lastInsertRowid),
      login: draft.login,
      displayName: draft.displayName,
      role: draft.role,
      email: null,
      superAdmin: false,
      active: true,
      capacity: null,
    }
  }

  function bootstrapSuperAdmin(seed: SuperAdminSeed): BoardUser {
    if (selectUserByLogin.get(seed.login) === undefined) {
      enrolUser({ login: seed.login, displayName: seed.login, password: seed.password, role: 'director' })
    }
    updateSuperAdmin.run(1, seed.login)
    reactivateByLogin.run(seed.login)
    return toUser(demandUser(seed.login))
  }

  function enrolExternalUser(draft: ExternalUserDraft): BoardUser {
    if (selectUserByLogin.get(draft.login) !== undefined) {
      throw new LoginTakenError(draft.login)
    }
    const holder = draft.isEmailVerified
      ? selectVerifiedUserByEmail.get(draft.email.toLowerCase())
      : selectUserByEmail.get(draft.email.toLowerCase())
    if (holder !== undefined) {
      throw new EmailTakenError()
    }
    const unusablePassword = hashPassword(randomBytes(TOKEN_BYTES).toString('hex'))
    insertExternalUser.run(
      draft.login,
      draft.displayName,
      unusablePassword,
      draft.role,
      draft.email.toLowerCase(),
      draft.subject,
      draft.isEmailVerified ? 1 : 0,
    )
    return toUser(demandUser(draft.login))
  }

  return { enrolUser, bootstrapSuperAdmin, enrolExternalUser }
}
