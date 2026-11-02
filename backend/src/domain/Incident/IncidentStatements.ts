import type Database from 'better-sqlite3'
import type { Incident, IncidentState, OriginKind } from './Incident.js'

type OriginRow = {
  id: number
  slug: string
  name: string
  kind: OriginKind
}

type IncidentRow = {
  id: number
  origin_id: number
  fingerprint: string
  title: string
  detail: string
  occurrences: number
  state: IncidentState
  story_id: number | null
  refusal_reason: string | null
}

export function toIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    originId: row.origin_id,
    fingerprint: row.fingerprint,
    title: row.title,
    detail: row.detail,
    occurrences: row.occurrences,
    state: row.state,
    storyId: row.story_id,
    refusalReason: row.refusal_reason,
  }
}

export function prepareIncidentStatements(db: Database.Database) {
  return {
    insertOrigin: db.prepare<[string, string, OriginKind]>(
      'INSERT INTO incident_origin (slug, name, kind) VALUES (?, ?, ?)',
    ),
    selectOriginBySlug: db.prepare<[string], OriginRow>('SELECT * FROM incident_origin WHERE slug = ?'),
    selectOriginById: db.prepare<[number], OriginRow>('SELECT * FROM incident_origin WHERE id = ?'),
    selectOrigins: db.prepare<[], OriginRow>('SELECT * FROM incident_origin ORDER BY slug'),
    insertIncident: db.prepare<[number, string, string, string]>(
      'INSERT INTO incident (origin_id, fingerprint, title, detail) VALUES (?, ?, ?, ?)',
    ),
    bumpIncident: db.prepare<[number, string]>(
      `UPDATE incident SET occurrences = occurrences + 1, last_seen_at = datetime('now')
      WHERE origin_id = ? AND fingerprint = ?`,
    ),
    selectByFingerprint: db.prepare<[number, string], IncidentRow>(
      'SELECT * FROM incident WHERE origin_id = ? AND fingerprint = ?',
    ),
    selectIncident: db.prepare<[number], IncidentRow>('SELECT * FROM incident WHERE id = ?'),
    selectIncidents: db.prepare<[], IncidentRow>('SELECT * FROM incident ORDER BY id'),
    selectIncidentsByState: db.prepare<[IncidentState], IncidentRow>(
      'SELECT * FROM incident WHERE state = ? ORDER BY id',
    ),
    acceptRow: db.prepare<[number, number]>("UPDATE incident SET state = 'accepted', story_id = ? WHERE id = ?"),
    refuseRow: db.prepare<[string, number]>(
      "UPDATE incident SET state = 'refused', refusal_reason = ? WHERE id = ?",
    ),
  }
}
