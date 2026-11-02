import { createIdentityCredentialChanges } from './IdentityCredentialChanges.js'
import type { IdentityLookups } from './IdentityLookups.js'
import { toUser } from './IdentityRows.js'
import type { IdentityStatements } from './IdentityStatements.js'
import { LastSuperAdminError } from './IdentityViolation.js'
import type { BoardUser } from './Identity.js'
import type { SessionStore } from './SessionStore.js'

export function createIdentityAccountChanges(
  statements: IdentityStatements,
  lookups: Pick<IdentityLookups, 'demandUser' | 'activeSuperAdmins'>,
  sessions: Pick<SessionStore, 'revokeSessionsOf'>,
) {
  const { demandUser, activeSuperAdmins } = lookups
  const { revokeSessionsOf } = sessions
  const { updateSuperAdmin, disableByLogin, reactivateByLogin, updateCapacity } = statements

  function changeSuperAdmin(login: string, superAdmin: boolean): BoardUser {
    const row = demandUser(login)
    if (!superAdmin && row.super_admin === 1 && activeSuperAdmins() <= 1) {
      throw new LastSuperAdminError()
    }
    updateSuperAdmin.run(superAdmin ? 1 : 0, login)
    return { ...toUser(row), superAdmin }
  }

  function changeActive(login: string, active: boolean): BoardUser {
    const row = demandUser(login)
    if (!active && row.disabled_at === null) {
      if (row.super_admin === 1 && activeSuperAdmins() <= 1) {
        throw new LastSuperAdminError()
      }
      disableByLogin.run(login)
      revokeSessionsOf(row.id)
    }
    if (active && row.disabled_at !== null) {
      reactivateByLogin.run(login)
    }
    return toUser(demandUser(login))
  }

  function changeCapacity(login: string, capacity: number | null): BoardUser {
    demandUser(login)
    updateCapacity.run(capacity, login)
    return toUser(demandUser(login))
  }

  return {
    changeSuperAdmin,
    changeActive,
    changeCapacity,
    ...createIdentityCredentialChanges(statements, lookups, sessions),
    disableUser: (login: string): void => {
      disableByLogin.run(login)
    },
  }
}
