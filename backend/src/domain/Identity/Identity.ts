export type UserRole = 'director' | 'architect'

export type BoardUser = {
  id: number
  login: string
  displayName: string
  role: UserRole
  email: string | null
  superAdmin: boolean
  active: boolean
  capacity: number | null
}

export type SuperAdminSeed = {
  login: string
  password: string
}

export type UserDraft = {
  login: string
  displayName: string
  password: string
  role: UserRole
}

export type ExternalUserDraft = {
  login: string
  displayName: string
  email: string
  role: UserRole
  subject: string
}

export type OpenedSession = {
  user: BoardUser
  token: string
  expiresAt: string
}

export const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 14
