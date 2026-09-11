export const ACCOUNT_ROLE_SEQUENCE = ['director', 'architect'] as const

export type AccountRole = (typeof ACCOUNT_ROLE_SEQUENCE)[number]

export type Account = {
  login: string
  displayName: string
  role: AccountRole
  email: string | null
}
