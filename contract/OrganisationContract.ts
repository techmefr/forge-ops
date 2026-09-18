export const SOLE_ORGANISATION = 'sole'

export type Organisation = {
  id: number
  slug: string
  name: string
}

export const PROVIDER_KINDS = ['password', 'microsoft', 'google', 'magicLink'] as const

export type ProviderKind = (typeof PROVIDER_KINDS)[number]

export const PROVIDER_PRIORITY: readonly ProviderKind[] = [
  'password',
  'microsoft',
  'google',
  'magicLink',
]

export type AuthProvider = {
  kind: ProviderKind
  enabled: boolean
  issuer: string | null
  clientId: string | null
}

export type InstanceToken = {
  id: number
  organisationId: number
  name: string
  createdAt: string
  lastSeenAt: string | null
  revokedAt: string | null
}

export type MintedToken = {
  token: InstanceToken
  secret: string
}
