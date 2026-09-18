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
  type ProviderKind,
  type ProviderRefusal,
} from './Organisation.js'

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

type OrganisationRow = { id: number; slug: string; name: string }

type ProviderRow = {
  kind: ProviderKind
  enabled: number
  issuer: string | null
  client_id: string | null
}

type TokenRow = {
  id: number
  organisation_id: number
  name: string
  created_at: string
  last_seen_at: string | null
  revoked_at: string | null
}

function fingerprint(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export function createOrganisationRepository(db: Database.Database): OrganisationRepository {
  const selectOrganisation = db.prepare<[string], OrganisationRow>(
    'SELECT id, slug, name FROM organisation WHERE slug = ?',
  )
  const insertOrganisation = db.prepare<[string, string]>(
    'INSERT INTO organisation (slug, name) VALUES (?, ?)',
  )
  const selectProviders = db.prepare<[number], ProviderRow>(
    'SELECT kind, enabled, issuer, client_id FROM auth_provider WHERE organisation_id = ?',
  )
  const writeProvider = db.prepare<[number, string, number, string | null, string | null]>(
    `INSERT INTO auth_provider (organisation_id, kind, enabled, issuer, client_id)
     VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (organisation_id, kind) DO UPDATE SET
        enabled = excluded.enabled,
        issuer = excluded.issuer,
        client_id = excluded.client_id`,
  )
  const insertToken = db.prepare<[number, string, string]>(
    'INSERT INTO instance_token (organisation_id, name, token_hash) VALUES (?, ?, ?)',
  )
  const selectTokens = db.prepare<[number], TokenRow>(
    `SELECT id, organisation_id, name, created_at, last_seen_at, revoked_at
       FROM instance_token WHERE organisation_id = ? ORDER BY id`,
  )
  const selectToken = db.prepare<[number], TokenRow>(
    `SELECT id, organisation_id, name, created_at, last_seen_at, revoked_at
       FROM instance_token WHERE id = ?`,
  )
  const selectTokenByHash = db.prepare<[string], TokenRow & { token_hash: string }>(
    `SELECT id, organisation_id, name, created_at, last_seen_at, revoked_at, token_hash
       FROM instance_token WHERE token_hash = ?`,
  )
  const revoke = db.prepare<[number]>(
    "UPDATE instance_token SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL",
  )
  const touchToken = db.prepare<[number]>(
    "UPDATE instance_token SET last_seen_at = datetime('now') WHERE id = ?",
  )

  function toProvider(row: ProviderRow): AuthProvider {
    return {
      kind: row.kind,
      enabled: row.enabled === 1,
      issuer: row.issuer,
      clientId: row.client_id,
    }
  }

  function toToken(row: TokenRow): InstanceToken {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      revokedAt: row.revoked_at,
    }
  }

  function listProviders(organisationId: number): readonly AuthProvider[] {
    const written = selectProviders.all(organisationId).map(toProvider)
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
