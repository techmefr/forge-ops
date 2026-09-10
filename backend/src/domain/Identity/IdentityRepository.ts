import type Database from 'better-sqlite3'
import { createHash, randomBytes } from 'node:crypto'
import {
  hashPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
} from '../../technical/Auth/PasswordHash.js'
import { SESSION_LIFETIME_MS, type BoardUser, type OpenedSession, type UserDraft, type UserRole } from './Identity.js'
import {
  AccountDisabledError,
  EmailTakenError,
  LoginRefusedError,
  LoginTakenError,
  PasswordRefusedError,
  UnknownAccountError,
} from './IdentityViolation.js'

const TOKEN_BYTES = 32

type UserRow = {
  id: number
  login: string
  display_name: string
  password_hash: string
  role: UserRole
  email: string | null
  disabled_at: string | null
}

export type IdentityClock = () => number

export type IdentityRepositoryInput = {
  clock?: IdentityClock
}

export type IdentityRepository = {
  enrolUser: (draft: UserDraft) => BoardUser
  disableUser: (login: string) => void
  countUsers: () => number
  openSession: (login: string, password: string) => OpenedSession
  readSession: (token: string) => BoardUser | null
  closeSession: (token: string) => void
  findUser: (login: string) => BoardUser | null
  changeEmail: (login: string, email: string) => BoardUser
  changeDisplayName: (login: string, displayName: string) => BoardUser
  changePassword: (login: string, current: string, next: string) => void
}

function toUser(row: UserRow): BoardUser {
  return {
    id: row.id,
    login: row.login,
    displayName: row.display_name,
    role: row.role,
    email: row.email ?? null,
  }
}

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createIdentityRepository(
  db: Database.Database,
  { clock = Date.now }: IdentityRepositoryInput = {},
): IdentityRepository {
  const insertUser = db.prepare<[string, string, string, UserRole]>(
    'INSERT INTO board_user (login, display_name, password_hash, role) VALUES (?, ?, ?, ?)',
  )
  const selectUserByLogin = db.prepare<[string], UserRow>('SELECT * FROM board_user WHERE login = ?')
  const countAllUsers = db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM board_user')
  const disableByLogin = db.prepare<[string]>(
    "UPDATE board_user SET disabled_at = datetime('now') WHERE login = ?",
  )
  const insertSession = db.prepare<[string, number, string]>(
    'INSERT INTO board_session (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
  )
  const selectSession = db.prepare<[string], UserRow & { expires_at: string; revoked_at: string | null }>(
    `SELECT board_user.*, board_session.expires_at AS expires_at, board_session.revoked_at AS revoked_at
       FROM board_session
       JOIN board_user ON board_user.id = board_session.user_id
      WHERE board_session.token_hash = ?`,
  )
  const revokeSession = db.prepare<[string]>(
    "UPDATE board_session SET revoked_at = datetime('now') WHERE token_hash = ?",
  )
  const revokeSessionsOfUser = db.prepare<[number]>(
    "UPDATE board_session SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL",
  )
  const selectUserByEmail = db.prepare<[string], UserRow>('SELECT * FROM board_user WHERE email = ?')
  const updateEmail = db.prepare<[string, string]>('UPDATE board_user SET email = ? WHERE login = ?')
  const updateDisplayName = db.prepare<[string, string]>(
    'UPDATE board_user SET display_name = ? WHERE login = ?',
  )
  const updatePassword = db.prepare<[string, string]>(
    'UPDATE board_user SET password_hash = ? WHERE login = ?',
  )

  function demandUser(login: string): UserRow {
    const row = selectUserByLogin.get(login)
    if (row === undefined) {
      throw new UnknownAccountError(login)
    }
    return row
  }

  return {
    enrolUser: (draft) => {
      if (selectUserByLogin.get(draft.login) !== undefined) {
        throw new LoginTakenError(draft.login)
      }
      if (draft.password.length < PASSWORD_MIN_LENGTH) {
        throw new PasswordRefusedError(`il faut au moins ${PASSWORD_MIN_LENGTH} caracteres`)
      }
      if (draft.password.length > PASSWORD_MAX_LENGTH) {
        throw new PasswordRefusedError(`il faut au plus ${PASSWORD_MAX_LENGTH} caracteres`)
      }
      const stored = hashPassword(draft.password)
      const info = insertUser.run(draft.login, draft.displayName, stored, draft.role)
      return {
        id: Number(info.lastInsertRowid),
        login: draft.login,
        displayName: draft.displayName,
        role: draft.role,
        email: null,
      }
    },

    disableUser: (login) => {
      disableByLogin.run(login)
    },

    countUsers: () => countAllUsers.get()?.total ?? 0,

    openSession: (login, password) => {
      const row = selectUserByLogin.get(login)
      if (row === undefined || !verifyPassword(password, row.password_hash)) {
        throw new LoginRefusedError()
      }
      if (row.disabled_at !== null) {
        throw new AccountDisabledError(login)
      }
      const token = randomBytes(TOKEN_BYTES).toString('hex')
      const expiresAt = new Date(clock() + SESSION_LIFETIME_MS).toISOString()
      insertSession.run(digest(token), row.id, expiresAt)
      return { user: toUser(row), token, expiresAt }
    },

    readSession: (token) => {
      const row = selectSession.get(digest(token))
      if (row === undefined || row.revoked_at !== null || row.disabled_at !== null) {
        return null
      }
      if (Date.parse(row.expires_at) <= clock()) {
        return null
      }
      return toUser(row)
    },

    closeSession: (token) => {
      revokeSession.run(digest(token))
    },

    findUser: (login) => {
      const row = selectUserByLogin.get(login)
      return row === undefined ? null : toUser(row)
    },

    changeEmail: (login, email) => {
      const row = demandUser(login)
      const worn = selectUserByEmail.get(email)
      if (worn !== undefined && worn.id !== row.id) {
        throw new EmailTakenError(email)
      }
      updateEmail.run(email, login)
      return { ...toUser(row), email }
    },

    changeDisplayName: (login, displayName) => {
      const row = demandUser(login)
      updateDisplayName.run(displayName, login)
      return { ...toUser(row), displayName }
    },

    changePassword: (login, current, next) => {
      const row = demandUser(login)
      if (!verifyPassword(current, row.password_hash)) {
        throw new LoginRefusedError()
      }
      if (next.length < PASSWORD_MIN_LENGTH) {
        throw new PasswordRefusedError(`il faut au moins ${PASSWORD_MIN_LENGTH} caracteres`)
      }
      if (next.length > PASSWORD_MAX_LENGTH) {
        throw new PasswordRefusedError(`il faut au plus ${PASSWORD_MAX_LENGTH} caracteres`)
      }
      updatePassword.run(hashPassword(next), login)
      revokeSessionsOfUser.run(row.id)
    },
  }
}
