import type Database from 'better-sqlite3'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  PROVIDER_KINDS,
  SOLE_ORGANISATION,
  providerRefusalOf,
  type AuthProvider,
  type InstanceToken,
  type MintedToken,
  type Organisation,
  type ProviderDraft,
  type ProviderRefusal,
} from './Organisation.js'
import { prepareOrganisationStatements, toProvider, toToken } from './OrganisationStatements.js'

export class ProviderRefusedError extends Error {
  constructor(public readonly refusal: ProviderRefusal) {
    super(`le fournisseur d identite est refuse: ${refusal}`)
    this.name = 'ProviderRefusedError'
  }
}

export class InstanceTokenNotFoundError extends Error {
  constructor(tokenId: number) {
    super(`aucun jeton d instance ${tokenId}`)
    this.name = 'InstanceTokenNotFoundError'
  }
}

export type OrganisationRepository = {
  soleOrganisation: () => Organisation
  listProviders: (organisationId: number) => readonly AuthProvider[]
  settleProvider: (organisationId: number, draft: ProviderDraft) => AuthProvider
  mintToken: (organisationId: number, name: string) => MintedToken
  listTokens: (organisationId: number) => readonly InstanceToken[]
  revokeToken: (tokenId: number) => InstanceToken
  identifyToken: (secret: string) => InstanceToken | null
}

function fingerprint(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

function withDefaultProviders(written: readonly AuthProvider[]): readonly AuthProvider[] {
  return PROVIDER_KINDS.map(
    (kind) =>
      written.find((provider) => provider.kind === kind) ?? {
        kind,
        enabled: kind === 'password',
        issuer: null,
        clientId: null,
      },
  )
}

export function createOrganisationRepository(db: Database.Database): OrganisationRepository {
  const {
    selectOrganisation,
    insertOrganisation,
    selectProviders,
    writeProvider,
    insertToken,
    selectTokens,
    selectToken,
    selectTokenByHash,
    revoke,
    touchToken,
  } = prepareOrganisationStatements(db)

  function listProviders(organisationId: number): readonly AuthProvider[] {
    return withDefaultProviders(selectProviders.all(organisationId).map(toProvider))
  }

  function findToken(tokenId: number): InstanceToken {
    const row = selectToken.get(tokenId)
    if (row === undefined) {
      throw new InstanceTokenNotFoundError(tokenId)
    }
    return toToken(row)
  }

  return {
    soleOrganisation: () => {
      const known = selectOrganisation.get(SOLE_ORGANISATION)
      if (known !== undefined) {
        return known
      }
      insertOrganisation.run(SOLE_ORGANISATION, 'Forge')
      const written = selectOrganisation.get(SOLE_ORGANISATION)
      if (written === undefined) {
        throw new Error("l'organisation unique n'a pas pu etre ecrite")
      }
      return written
    },

    listProviders,

    settleProvider: (organisationId, draft) => {
      const refusal = providerRefusalOf(draft, listProviders(organisationId))
      if (refusal !== null) {
        throw new ProviderRefusedError(refusal)
      }
      writeProvider.run(
        organisationId,
        draft.kind,
        draft.enabled ? 1 : 0,
        draft.issuer,
        draft.clientId,
      )
      const written = listProviders(organisationId).find((one) => one.kind === draft.kind)
      if (written === undefined) {
        throw new ProviderRefusedError('UnknownProvider')
      }
      return written
    },

    mintToken: (organisationId, name) => {
      const secret = randomBytes(32).toString('base64url')
      const written = insertToken.run(organisationId, name, fingerprint(secret))
      return { token: findToken(Number(written.lastInsertRowid)), secret }
    },

    listTokens: (organisationId) => selectTokens.all(organisationId).map(toToken),

    revokeToken: (tokenId) => {
      findToken(tokenId)
      revoke.run(tokenId)
      return findToken(tokenId)
    },

    identifyToken: (secret) => {
      const row = selectTokenByHash.get(fingerprint(secret))
      if (row === undefined || row.revoked_at !== null) {
        return null
      }
      const seen = Buffer.from(row.token_hash)
      if (!timingSafeEqual(seen, Buffer.from(fingerprint(secret)))) {
        return null
      }
      touchToken.run(row.id)
      return toToken(row)
    },
  }
}
