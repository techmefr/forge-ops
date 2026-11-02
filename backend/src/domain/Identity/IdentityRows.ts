import type { BoardUser, UserRole } from './Identity.js'

export const TOKEN_BYTES = 32

export type UserRow = {
  id: number
  login: string
  display_name: string
  password_hash: string
  role: UserRole
  email: string | null
  external_subject: string | null
  super_admin: number
  capacity: number | null
  disabled_at: string | null
}

export function toUser(row: UserRow): BoardUser {
  return {
    id: row.id,
    login: row.login,
    displayName: row.display_name,
    role: row.role,
    email: row.email ?? null,
    superAdmin: row.super_admin === 1,
    active: row.disabled_at === null,
    capacity: row.capacity ?? null,
  }
}
