export {
  PROVIDER_KINDS,
  PROVIDER_PRIORITY,
  SOLE_ORGANISATION,
} from '../../../../contract/OrganisationContract.js'
export type {
  AuthProvider,
  InstanceToken,
  MintedToken,
  Organisation,
  ProviderKind,
} from '../../../../contract/OrganisationContract.js'

import {
  PROVIDER_KINDS,
  PROVIDER_PRIORITY,
  type AuthProvider,
  type InstanceToken,
  type ProviderKind,
} from '../../../../contract/OrganisationContract.js'

export type ProviderDraft = {
  kind: string
  enabled: boolean
  issuer: string | null
  clientId: string | null
}

export type ProviderRefusal =
  | 'UnknownProvider'
  | 'MissingIssuer'
  | 'MissingClientId'
  | 'LastWayIn'

const NEEDS_AN_ISSUER: readonly ProviderKind[] = ['microsoft', 'google']

export function providerRefusalOf(
  draft: ProviderDraft,
  others: readonly AuthProvider[],
): ProviderRefusal | null {
  const kind = PROVIDER_KINDS.find((candidate) => candidate === draft.kind)
  if (kind === undefined) {
    return 'UnknownProvider'
  }
  if (!draft.enabled) {
    const left = others.filter((one) => one.kind !== kind && one.enabled)
    return left.length === 0 ? 'LastWayIn' : null
  }
  if (NEEDS_AN_ISSUER.includes(kind)) {
    if (draft.issuer === null || draft.issuer.trim() === '') {
      return 'MissingIssuer'
    }
    if (draft.clientId === null || draft.clientId.trim() === '') {
      return 'MissingClientId'
    }
  }
  return null
}

export function waysIn(providers: readonly AuthProvider[]): readonly ProviderKind[] {
  return PROVIDER_PRIORITY.filter((kind) =>
    providers.some((provider) => provider.kind === kind && provider.enabled),
  )
}

export function tokenIsLive(token: InstanceToken): boolean {
  return token.revokedAt === null
}

export function belongsTo(row: { organisationId: number }, organisationId: number): boolean {
  return row.organisationId === organisationId
}

export function keptFor<T extends { organisationId: number }>(
  rows: readonly T[],
  organisationId: number,
): readonly T[] {
  return rows.filter((row) => belongsTo(row, organisationId))
}
