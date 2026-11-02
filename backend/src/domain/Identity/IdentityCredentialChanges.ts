import { hashPassword, verifyPassword } from '../../technical/Auth/PasswordHash.js'
import { assertPasswordLength } from './IdentityEnrolment.js'
import type { IdentityLookups } from './IdentityLookups.js'
import { toUser } from './IdentityRows.js'
import type { IdentityStatements } from './IdentityStatements.js'
import { EmailTakenError, ExternalSubjectTakenError, LoginRefusedError } from './IdentityViolation.js'
import type { BoardUser } from './Identity.js'
import type { SessionStore } from './SessionStore.js'

export function createIdentityCredentialChanges(
  {
    selectUserByEmail,
    selectVerifiedUserByEmail,
    updateEmail,
    markEmailVerified,
    updateSubject,
    updateDisplayName,
    updatePassword,
  }: IdentityStatements,
  { demandUser }: Pick<IdentityLookups, 'demandUser'>,
  { revokeSessionsOf }: Pick<SessionStore, 'revokeSessionsOf'>,
) {
  function changeEmail(login: string, rawEmail: string): BoardUser {
    const email = rawEmail.toLowerCase()
    const row = demandUser(login)
    const worn = selectUserByEmail.get(email.toLowerCase())
    if (worn !== undefined && worn.id !== row.id) {
      throw new EmailTakenError()
    }
    updateEmail.run(email, login)
    return { ...toUser(row), email }
  }

  function verifyEmail(login: string): BoardUser {
    const row = demandUser(login)
    const holder = row.email === null ? undefined : selectVerifiedUserByEmail.get(row.email.toLowerCase())
    if (holder !== undefined && holder.id !== row.id) {
      throw new EmailTakenError()
    }
    markEmailVerified.run(login)
    return toUser(demandUser(login))
  }

  function linkExternalSubject(login: string, subject: string): BoardUser {
    const row = demandUser(login)
    if (row.external_subject !== null && row.external_subject !== subject) {
      throw new ExternalSubjectTakenError(login)
    }
    updateSubject.run(subject, login)
    return toUser(demandUser(login))
  }

  function changeDisplayName(login: string, displayName: string): BoardUser {
    const row = demandUser(login)
    updateDisplayName.run(displayName, login)
    return { ...toUser(row), displayName }
  }

  function changePassword(login: string, current: string, next: string): void {
    const row = demandUser(login)
    if (!verifyPassword(current, row.password_hash)) {
      throw new LoginRefusedError()
    }
    assertPasswordLength(next)
    updatePassword.run(hashPassword(next), login)
    revokeSessionsOf(row.id)
  }

  return { changeEmail, verifyEmail, linkExternalSubject, changeDisplayName, changePassword }
}
