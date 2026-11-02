import type Database from 'better-sqlite3'
import { createHash, randomBytes } from 'node:crypto'
import { spendVerificationTime, verifyPassword } from '../../technical/Auth/PasswordHash.js'
import { SESSION_LIFETIME_MS, type BoardUser, type OpenedSession } from './Identity.js'
import { TOKEN_BYTES, toUser, type UserRow } from './IdentityRows.js'
import { AccountDisabledError, LoginRefusedError, UnknownAccountError } from './IdentityViolation.js'

export type SessionStore = {
  openSession: (login: string, password: string) => OpenedSession
  openSessionFor: (login: string) => OpenedSession
  readSession: (token: string) => BoardUser | null
  closeSession: (token: string) => void
  revokeSessionsOf: (userId: number) => void
}

export type SessionStoreInput = {
  clock: () => number
}

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createSessionStore(db: Database.Database, { clock }: SessionStoreInput): SessionStore {
  const selectUserByLogin = db.prepare<[string], UserRow>('SELECT * FROM board_user WHERE login = ?')
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

  function startSession(row: UserRow): OpenedSession {
    if (row.disabled_at !== null) {
      throw new AccountDisabledError(row.login)
    }
    const token = randomBytes(TOKEN_BYTES).toString('hex')
    const expiresAt = new Date(clock() + SESSION_LIFETIME_MS).toISOString()
    insertSession.run(digest(token), row.id, expiresAt)
    return { user: toUser(row), token, expiresAt }
  }

  return {
    openSessionFor: (login) => {
      const row = selectUserByLogin.get(login)
      if (row === undefined) {
        throw new UnknownAccountError(login)
      }
      return startSession(row)
    },

    openSession: (login, password) => {
      const row = selectUserByLogin.get(login)
      if (row === undefined) {
        spendVerificationTime(password)
        throw new LoginRefusedError()
      }
      if (!verifyPassword(password, row.password_hash)) {
        throw new LoginRefusedError()
      }
      return startSession(row)
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

    revokeSessionsOf: (userId) => {
      revokeSessionsOfUser.run(userId)
    },
  }
}
