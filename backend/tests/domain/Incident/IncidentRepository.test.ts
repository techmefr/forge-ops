import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createIncidentRepository,
  type IncidentRepository,
} from '../../../src/domain/Incident/IncidentRepository.js'
import {
  IncidentAlreadyRuledError,
  IncidentNotFoundError,
  OriginNotFoundError,
  OriginSlugTakenError,
  RefusalReasonRequiredError,
} from '../../../src/domain/Incident/IncidentViolation.js'

let db: Database.Database
let stories: StoryRepository
let incidents: IncidentRepository
let epicId: number

const SIGNALEMENT = {
  originSlug: 'sentry',
  fingerprint: 'TypeError:cannot-read-mails',
  title: 'TypeError sur la liste des mails',
  detail: "Cannot read properties of undefined (reading 'mails')",
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  incidents = createIncidentRepository(db, { stories })
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  epicId = stories.createEpic({ projectId: project.id, title: 'Incidents', businessIntent: 'corriger' }).id
  incidents.declareOrigin({ slug: 'sentry', name: 'Sentry', kind: 'sentry' })
})

describe('declareOrigin', () => {
  it('refuse deux sources sur le meme slug', () => {
    expect(() => incidents.declareOrigin({ slug: 'sentry', name: 'Autre', kind: 'sentry' })).toThrow(
      OriginSlugTakenError,
    )
  })

  it('liste les sources declarees', () => {
    expect(incidents.listOrigins().map((origin) => origin.slug)).toEqual(['sentry'])
  })
})

describe('reportIncident', () => {
  it('enregistre un signalement en attente de decision humaine', () => {
    const incident = incidents.reportIncident(SIGNALEMENT)

    expect(incident).toMatchObject({ state: 'pending', occurrences: 1, storyId: null })
  })

  it('refuse un signalement venu d une source inconnue', () => {
    expect(() => incidents.reportIncident({ ...SIGNALEMENT, originSlug: 'inconnue' })).toThrow(
      OriginNotFoundError,
    )
  })

  it('compte une seconde occurrence plutot que de creer un doublon', () => {
    incidents.reportIncident(SIGNALEMENT)

    const again = incidents.reportIncident(SIGNALEMENT)

    expect(again.occurrences).toBe(2)
    expect(incidents.listIncidents('pending')).toHaveLength(1)
  })

  it('garde deux empreintes differentes comme deux incidents', () => {
    incidents.reportIncident(SIGNALEMENT)
    incidents.reportIncident({ ...SIGNALEMENT, fingerprint: 'autre' })

    expect(incidents.listIncidents('pending')).toHaveLength(2)
  })

  it('ne ressuscite pas un incident deja refuse, il le recompte seulement', () => {
    const incident = incidents.reportIncident(SIGNALEMENT)
    incidents.refuseIncident(incident.id, 'attendu, le client n a pas de mails')

    const again = incidents.reportIncident(SIGNALEMENT)

    expect(again.state).toBe('refused')
    expect(again.occurrences).toBe(2)
  })
})

describe('acceptIncident', () => {
  it('cree la story et sa jumelle de test a partir de l incident', () => {
    const incident = incidents.reportIncident(SIGNALEMENT)

    const accepted = incidents.acceptIncident(incident.id, epicId)

    expect(accepted.incident.state).toBe('accepted')
    expect(accepted.story.title).toContain('TypeError sur la liste des mails')
    expect(stories.findTwin(accepted.story.id)).not.toBeNull()
  })

  it('met l empreinte dans la jumelle, pour que le test de non regression la vise', () => {
    const incident = incidents.reportIncident(SIGNALEMENT)

    const accepted = incidents.acceptIncident(incident.id, epicId)

    expect(stories.findTwin(accepted.story.id)?.body).toContain('TypeError:cannot-read-mails')
  })

  it('rattache la story a l incident', () => {
    const incident = incidents.reportIncident(SIGNALEMENT)

    const accepted = incidents.acceptIncident(incident.id, epicId)

    expect(accepted.incident.storyId).toBe(accepted.story.id)
  })

  it('refuse d accepter deux fois', () => {
    const incident = incidents.reportIncident(SIGNALEMENT)
    incidents.acceptIncident(incident.id, epicId)

    expect(() => incidents.acceptIncident(incident.id, epicId)).toThrow(IncidentAlreadyRuledError)
  })

  it('refuse un incident inconnu', () => {
    expect(() => incidents.acceptIncident(404, epicId)).toThrow(IncidentNotFoundError)
  })

  it('ne cree aucune story quand l acceptation est refusee', () => {
    const incident = incidents.reportIncident(SIGNALEMENT)
    incidents.refuseIncident(incident.id, 'pas un bug')

    try {
      incidents.acceptIncident(incident.id, epicId)
    } catch {
      // le refus est le sujet du test precedent
    }

    expect(stories.listBacklog()).toHaveLength(0)
  })
})

describe('refuseIncident', () => {
  it('refuse en disant pourquoi', () => {
    const incident = incidents.reportIncident(SIGNALEMENT)

    const refused = incidents.refuseIncident(incident.id, 'comportement attendu')

    expect(refused).toMatchObject({ state: 'refused', refusalReason: 'comportement attendu' })
  })

  it('exige une raison', () => {
    const incident = incidents.reportIncident(SIGNALEMENT)

    expect(() => incidents.refuseIncident(incident.id, '  ')).toThrow(RefusalReasonRequiredError)
  })

  it('refuse de trancher deux fois', () => {
    const incident = incidents.reportIncident(SIGNALEMENT)
    incidents.refuseIncident(incident.id, 'comportement attendu')

    expect(() => incidents.refuseIncident(incident.id, 'encore')).toThrow(IncidentAlreadyRuledError)
  })
})

describe('listIncidents', () => {
  it('ne melange pas les incidents tranches avec ceux en attente', () => {
    const premier = incidents.reportIncident(SIGNALEMENT)
    incidents.reportIncident({ ...SIGNALEMENT, fingerprint: 'autre' })
    incidents.refuseIncident(premier.id, 'attendu')

    expect(incidents.listIncidents('pending')).toHaveLength(1)
    expect(incidents.listIncidents('refused')).toHaveLength(1)
  })

  it('rend tout quand aucun etat n est demande', () => {
    incidents.reportIncident(SIGNALEMENT)
    incidents.reportIncident({ ...SIGNALEMENT, fingerprint: 'autre' })

    expect(incidents.listIncidents()).toHaveLength(2)
  })
})
