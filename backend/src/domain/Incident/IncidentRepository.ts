import type Database from 'better-sqlite3'
import type { Story } from '../Story/Story.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { Incident, IncidentDraft, IncidentOrigin, IncidentState, OriginDraft } from './Incident.js'
import { prepareIncidentStatements, toIncident } from './IncidentStatements.js'
import {
  IncidentAlreadyRuledError,
  IncidentNotFoundError,
  OriginNotFoundError,
  OriginSlugTakenError,
  RefusalReasonRequiredError,
} from './IncidentViolation.js'

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

function writeStoryWithTwin(stories: StoryRepository, epicId: number, incident: Incident, originName: string): Story {
  const story = stories.writeStory({ epicId, title: incident.title, body: storyBody(incident, originName) })
  stories.writeTwin({ storyId: story.id, title: `tests ${incident.title}`, body: twinBody(incident) })
  return story
}

export function createIncidentRepository(
  db: Database.Database,
  { stories }: IncidentRepositoryInput,
): IncidentRepository {
  const {
    insertOrigin,
    selectOriginBySlug,
    selectOriginById,
    selectOrigins,
    insertIncident,
    bumpIncident,
    selectByFingerprint,
    selectIncident,
    selectIncidents,
    selectIncidentsByState,
    acceptRow,
    refuseRow,
  } = prepareIncidentStatements(db)

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
      const story = writeStoryWithTwin(stories, epicId, incident, origin?.name ?? 'une source inconnue')
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
