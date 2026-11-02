import type Database from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../../technical/Auth/PasswordHash.js'
import type { BoardUser } from './Identity.js'
import type { IdentityLookups } from './IdentityLookups.js'
import { TOKEN_BYTES, toUser } from './IdentityRows.js'
import { prepareErasureStatements } from './IdentityStatements.js'
import { LastSuperAdminError } from './IdentityViolation.js'

const ERASED_DISPLAY_NAME = 'Former user'

export function createIdentityErasure(
  db: Database.Database,
  { demandUser, activeSuperAdmins }: Pick<IdentityLookups, 'demandUser' | 'activeSuperAdmins'>,
) {
  const {
    erasedLoginColumns,
    eraseRequestedBy,
    eraseAccount,
    releaseProjects,
    deleteSessionsOfUser,
    deletePreferencesOfUser,
  } = prepareErasureStatements(db)

  function eraseUser(login: string): BoardUser {
    const row = demandUser(login)
    if (row.super_admin === 1 && row.disabled_at === null && activeSuperAdmins() <= 1) {
      throw new LastSuperAdminError()
    }
    const pseudonym = `erased-${row.id}`
    db.transaction(() => {
      eraseAccount.run(pseudonym, ERASED_DISPLAY_NAME, hashPassword(randomBytes(TOKEN_BYTES).toString('hex')), row.id)
      for (const update of erasedLoginColumns) {
        update.run(pseudonym, row.login)
      }
      eraseRequestedBy.run(pseudonym, row.login, row.display_name)
      releaseProjects.run(row.id)
      deleteSessionsOfUser.run(row.id)
      deletePreferencesOfUser.run(row.id)
    })()
    return toUser(demandUser(pseudonym))
  }

  return { eraseUser }
}
