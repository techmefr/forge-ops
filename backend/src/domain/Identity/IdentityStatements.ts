import type Database from 'better-sqlite3'
import type { UserRole } from './Identity.js'
import type { UserRow } from './IdentityRows.js'

const LOGIN_COLUMNS: readonly { table: string; column: string }[] = [
  { table: 'epic', column: 'assignee' },
  { table: 'story_step_back', column: 'asked_by' },
  { table: 'story_hold', column: 'asked_by' },
  { table: 'story_remark', column: 'author' },
  { table: 'story_message', column: 'author' },
  { table: 'project_decision', column: 'decided_by' },
  { table: 'project_risk', column: 'owner' },
  { table: 'epic_state_history', column: 'by' },
]

export type IdentityStatements = ReturnType<typeof prepareIdentityStatements>

export function prepareIdentityStatements(db: Database.Database) {
  return {
    insertUser: db.prepare<[string, string, string, UserRole]>(
      'INSERT INTO board_user (login, display_name, password_hash, role) VALUES (?, ?, ?, ?)',
    ),
    selectUserByLogin: db.prepare<[string], UserRow>('SELECT * FROM board_user WHERE login = ?'),
    countAllUsers: db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM board_user'),
    disableByLogin: db.prepare<[string]>("UPDATE board_user SET disabled_at = datetime('now') WHERE login = ?"),
    countActiveSuperAdmins: db.prepare<[], { total: number }>(
      'SELECT COUNT(*) AS total FROM board_user WHERE super_admin = 1 AND disabled_at IS NULL',
    ),
    reactivateByLogin: db.prepare<[string]>('UPDATE board_user SET disabled_at = NULL WHERE login = ?'),
    updateCapacity: db.prepare<[number | null, string]>('UPDATE board_user SET capacity = ? WHERE login = ?'),
    selectEveryUser: db.prepare<[], UserRow>('SELECT * FROM board_user ORDER BY display_name COLLATE NOCASE, login'),
    updateSuperAdmin: db.prepare<[number, string]>('UPDATE board_user SET super_admin = ? WHERE login = ?'),
    selectUserByEmail: db.prepare<[string], UserRow>('SELECT * FROM board_user WHERE lower(email) = ?'),
    selectVerifiedUserByEmail: db.prepare<[string], UserRow>(
      'SELECT * FROM board_user WHERE lower(email) = ? AND email_verified_at IS NOT NULL',
    ),
    updateEmail: db.prepare<[string, string]>(
      'UPDATE board_user SET email = ?, email_verified_at = NULL WHERE login = ?',
    ),
    markEmailVerified: db.prepare<[string]>(
      "UPDATE board_user SET email_verified_at = datetime('now') WHERE login = ? AND email IS NOT NULL",
    ),
    selectUserBySubject: db.prepare<[string], UserRow>('SELECT * FROM board_user WHERE external_subject = ?'),
    updateSubject: db.prepare<[string, string]>('UPDATE board_user SET external_subject = ? WHERE login = ?'),
    insertExternalUser: db.prepare<[string, string, string, UserRole, string, string, number]>(
      "INSERT INTO board_user (login, display_name, password_hash, role, email, external_subject, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') END)",
    ),
    updateDisplayName: db.prepare<[string, string]>('UPDATE board_user SET display_name = ? WHERE login = ?'),
    updatePassword: db.prepare<[string, string]>('UPDATE board_user SET password_hash = ? WHERE login = ?'),
  }
}

export function prepareErasureStatements(db: Database.Database) {
  return {
    erasedLoginColumns: LOGIN_COLUMNS.map(({ table, column }) =>
      db.prepare<[string, string]>(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`),
    ),
    eraseRequestedBy: db.prepare<[string, string, string]>(
      'UPDATE epic SET requested_by = ? WHERE requested_by = ? OR requested_by = ?',
    ),
    eraseAccount: db.prepare<[string, string, string, number]>(
      `UPDATE board_user
          SET login = ?, display_name = ?, password_hash = ?, email = NULL, email_verified_at = NULL, external_subject = NULL,
              capacity = NULL, super_admin = 0, disabled_at = COALESCE(disabled_at, datetime('now'))
        WHERE id = ?`,
    ),
    releaseProjects: db.prepare<[number]>('UPDATE project SET admin_user_id = NULL WHERE admin_user_id = ?'),
    deleteSessionsOfUser: db.prepare<[number]>('DELETE FROM board_session WHERE user_id = ?'),
    deletePreferencesOfUser: db.prepare<[number]>('DELETE FROM user_preference WHERE user_id = ?'),
  }
}
