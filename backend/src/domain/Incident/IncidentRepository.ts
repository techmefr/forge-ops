import type Database from 'better-sqlite3'
import type { Story } from '../Story/Story.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type {
  Incident,
  IncidentDraft,
  IncidentOrigin,
  IncidentState,
  OriginDraft,
  OriginKind,
} from './Incident.js'
import {
  IncidentAlreadyRuledError,
  IncidentNotFoundError,
  OriginNotFoundError,
  OriginSlugTakenError,
  RefusalReasonRequiredError,
} from './IncidentViolation.js'

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

export type AcceptedIncident = {
  incident: Incident
  story: Story
}

export type IncidentRepositoryInput = {
  stories: StoryRepository
}

export type IncidentRepository = {
  declareOrigin: (draft: OriginDraft) => IncidentOrigin
  listOrigins: () => readonly IncidentOrigin[]
  reportIncident: (draft: IncidentDraft) => Incident
  listIncidents: (state?: IncidentState) => readonly Incident[]
  findIncident: (incidentId: number) => Incident
  acceptIncident: (incidentId: number, epicId: number) => AcceptedIncident
  refuseIncident: (incidentId: number, reason: string) => Incident
}

function toIncident(row: IncidentRow): Incident {
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

function twinBody(incident: Incident): string {
  return [
    `Test de non regression pour l'incident ${incident.id}.`,
    '',
    `Empreinte a surveiller : ${incident.fingerprint}`,
    '',
    'Le rouge de depart est fourni par la source : reproduis-le avant de corriger.',
    '',
    incident.detail,
  ].join('\n')
}

function storyBody(incident: Incident, originName: string): string {
  return [
    `Signale par ${originName}, vu ${incident.occurrences} fois.`,
    '',
    `Empreinte : ${incident.fingerprint}`,
    '',
    incident.detail,
    '',
    "La correction part en production derriere un drapeau, surveille par la meme empreinte.",
  ].join('\n')
}

export function createIncidentRepository(
  db: Database.Database,
  { stories }: IncidentRepositoryInput,
): IncidentRepository {
  const insertOrigin = db.prepare<[string, string, OriginKind]>(
    'INSERT INTO incident_origin (slug, name, kind) VALUES (?, ?, ?)',
  )
  const selectOriginBySlug = db.prepare<[string], OriginRow>('SELECT * FROM incident_origin WHERE slug = ?')
  const selectOriginById = db.prepare<[number], OriginRow>('SELECT * FROM incident_origin WHERE id = ?')
  const selectOrigins = db.prepare<[], OriginRow>('SELECT * FROM incident_origin ORDER BY slug')
  const insertIncident = db.prepare<[number, string, string, string]>(
    'INSERT INTO incident (origin_id, fingerprint, title, detail) VALUES (?, ?, ?, ?)',
  )
  const bumpIncident = db.prepare<[number, string]>(
    `UPDATE incident SET occurrences = occurrences + 1, last_seen_at = datetime('now')
      WHERE origin_id = ? AND fingerprint = ?`,
  )
  const selectByFingerprint = db.prepare<[number, string], IncidentRow>(
    'SELECT * FROM incident WHERE origin_id = ? AND fingerprint = ?',
  )
  const selectIncident = db.prepare<[number], IncidentRow>('SELECT * FROM incident WHERE id = ?')
  const selectIncidents = db.prepare<[], IncidentRow>('SELECT * FROM incident ORDER BY id')
  const selectIncidentsByState = db.prepare<[IncidentState], IncidentRow>(
    'SELECT * FROM incident WHERE state = ? ORDER BY id',
  )
  const acceptRow = db.prepare<[number, number]>(
    "UPDATE incident SET state = 'accepted', story_id = ? WHERE id = ?",
  )
  const refuseRow = db.prepare<[string, number]>(
    "UPDATE incident SET state = 'refused', refusal_reason = ? WHERE id = ?",
  )

  function findIncident(incidentId: number): Incident {
    const row = selectIncident.get(incidentId)
    if (row === undefined) {
      throw new IncidentNotFoundError(incidentId)
    }
    return toIncident(row)
  }

  function requirePending(incidentId: number): Incident {
    const incident = findIncident(incidentId)
    if (incident.state !== 'pending') {
      throw new IncidentAlreadyRuledError(incidentId, incident.state)
    }
    return incident
  }

  return {
    declareOrigin: (draft) => {
      if (selectOriginBySlug.get(draft.slug) !== undefined) {
        throw new OriginSlugTakenError(draft.slug)
      }
      const info = insertOrigin.run(draft.slug, draft.name, draft.kind)
      return { id: Number(info.lastInsertRowid), ...draft }
    },

    listOrigins: () =>
      selectOrigins.all().map((row) => ({ id: row.id, slug: row.slug, name: row.name, kind: row.kind })),

    reportIncident: (draft) => {
      const origin = selectOriginBySlug.get(draft.originSlug)
      if (origin === undefined) {
        throw new OriginNotFoundError(draft.originSlug)
      }
      if (selectByFingerprint.get(origin.id, draft.fingerprint) !== undefined) {
        bumpIncident.run(origin.id, draft.fingerprint)
      } else {
        insertIncident.run(origin.id, draft.fingerprint, draft.title, draft.detail)
      }
      const row = selectByFingerprint.get(origin.id, draft.fingerprint)
      if (row === undefined) {
        throw new OriginNotFoundError(draft.originSlug)
      }
      return toIncident(row)
    },

    listIncidents: (state) =>
      (state === undefined ? selectIncidents.all() : selectIncidentsByState.all(state)).map(toIncident),

    findIncident,

    acceptIncident: (incidentId, epicId) => {
      const incident = requirePending(incidentId)
      const origin = selectOriginById.get(incident.originId)
      const story = stories.writeStory({
        epicId,
        title: incident.title,
        body: storyBody(incident, origin?.name ?? 'une source inconnue'),
      })
      stories.writeTwin({
        storyId: story.id,
        title: `tests ${incident.title}`,
        body: twinBody(incident),
      })
      acceptRow.run(story.id, incidentId)
      return { incident: findIncident(incidentId), story }
    },

    refuseIncident: (incidentId, reason) => {
      const incident = requirePending(incidentId)
      if (reason.trim() === '') {
        throw new RefusalReasonRequiredError()
      }
      refuseRow.run(reason, incident.id)
      return findIncident(incidentId)
    },
  }
}
