import type Database from 'better-sqlite3'
import type { AuthProvider, InstanceToken, ProviderKind } from './Organisation.js'

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

export function toProvider(row: ProviderRow): AuthProvider {
  return {
    kind: row.kind,
    enabled: row.enabled === 1,
    issuer: row.issuer,
    clientId: row.client_id,
  }
}

export function toToken(row: TokenRow): InstanceToken {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    name: row.name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
  }
}

export function prepareOrganisationStatements(db: Database.Database) {
  return {
    selectOrganisation: db.prepare<[string], OrganisationRow>('SELECT id, slug, name FROM organisation WHERE slug = ?'),
    insertOrganisation: db.prepare<[string, string]>('INSERT INTO organisation (slug, name) VALUES (?, ?)'),
    selectProviders: db.prepare<[number], ProviderRow>(
      'SELECT kind, enabled, issuer, client_id FROM auth_provider WHERE organisation_id = ?',
    ),
    writeProvider: db.prepare<[number, string, number, string | null, string | null]>(
      `INSERT INTO auth_provider (organisation_id, kind, enabled, issuer, client_id)
     VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (organisation_id, kind) DO UPDATE SET
        enabled = excluded.enabled,
        issuer = excluded.issuer,
        client_id = excluded.client_id`,
    ),
    insertToken: db.prepare<[number, string, string]>(
      'INSERT INTO instance_token (organisation_id, name, token_hash) VALUES (?, ?, ?)',
    ),
    selectTokens: db.prepare<[number], TokenRow>(
      `SELECT id, organisation_id, name, created_at, last_seen_at, revoked_at
       FROM instance_token WHERE organisation_id = ? ORDER BY id`,
    ),
    selectToken: db.prepare<[number], TokenRow>(
      `SELECT id, organisation_id, name, created_at, last_seen_at, revoked_at
       FROM instance_token WHERE id = ?`,
    ),
    selectTokenByHash: db.prepare<[string], TokenRow & { token_hash: string }>(
      `SELECT id, organisation_id, name, created_at, last_seen_at, revoked_at, token_hash
       FROM instance_token WHERE token_hash = ?`,
    ),
    revoke: db.prepare<[number]>(
      "UPDATE instance_token SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL",
    ),
    touchToken: db.prepare<[number]>("UPDATE instance_token SET last_seen_at = datetime('now') WHERE id = ?"),
  }
}
