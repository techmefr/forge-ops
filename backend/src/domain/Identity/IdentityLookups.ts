import { toUser, type UserRow } from './IdentityRows.js'
import type { IdentityStatements } from './IdentityStatements.js'
import { UnknownAccountError } from './IdentityViolation.js'
import type { BoardUser } from './Identity.js'

export type IdentityLookups = ReturnType<typeof createIdentityLookups>

export function createIdentityLookups(statements: IdentityStatements) {
  const {
    selectUserByLogin,
    selectUserBySubject,
    selectUserByEmail,
    selectVerifiedUserByEmail,
    selectEveryUser,
    countAllUsers,
    countActiveSuperAdmins,
  } = statements

  function demandUser(login: string): UserRow {
    const row = selectUserByLogin.get(login)
    if (row === undefined) {
      throw new UnknownAccountError(login)
    }
    return row
  }

  function userOrNull(row: UserRow | undefined): BoardUser | null {
    return row === undefined ? null : toUser(row)
  }

  return {
    demandUser,
    activeSuperAdmins: (): number => countActiveSuperAdmins.get()?.total ?? 0,
    findUser: (login: string) => userOrNull(selectUserByLogin.get(login)),
    findUserByExternalSubject: (subject: string) => userOrNull(selectUserBySubject.get(subject)),
    findUserByEmail: (email: string) => userOrNull(selectUserByEmail.get(email.toLowerCase())),
    findVerifiedUserByEmail: (email: string) => userOrNull(selectVerifiedUserByEmail.get(email.toLowerCase())),
    listUsers: (): readonly BoardUser[] => selectEveryUser.all().map(toUser),
    countUsers: (): number => countAllUsers.get()?.total ?? 0,
  }
}
