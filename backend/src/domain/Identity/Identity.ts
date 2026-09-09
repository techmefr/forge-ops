export type UserRole = 'director' | 'architect'

export type BoardUser = {
  id: number
  login: string
  displayName: string
  role: UserRole
}

export type UserDraft = {
  login: string
  displayName: string
  password: string
  role: UserRole
}

export type OpenedSession = {
  user: BoardUser
  token: string
  expiresAt: string
}

export const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 14
