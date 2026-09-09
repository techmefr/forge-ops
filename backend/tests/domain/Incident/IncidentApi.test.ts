import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createIncidentRepository } from '../../../src/domain/Incident/IncidentRepository.js'
import { createIncidentApi } from '../../../src/domain/Incident/IncidentApi.js'
import { createEventBus, type BoardEvent } from '../../../src/technical/Http/EventBus.js'

let db: Database.Database
let stories: StoryRepository
let api: Hono
let seen: BoardEvent[]
let epicId: number

const SIGNALEMENT = {
  fingerprint: 'TypeError:cannot-read-mails',
  title: 'TypeError sur la liste des mails',
  detail: "Cannot read properties of undefined (reading 'mails')",
}

function post(path: string, body?: unknown): Promise<Response> {
  return api.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(async () => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  seen = []
  const events = createEventBus()
  events.subscribe((event) => seen.push(event))
  api = createIncidentApi({ incidents: createIncidentRepository(db, { stories }), events })
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  epicId = stories.createEpic({ projectId: project.id, title: 'Incidents', businessIntent: 'corriger' }).id
  await post('/api/origins', { slug: 'sentry', name: 'Sentry', kind: 'sentry' })
})

describe('POST /api/origins/:slug/incidents', () => {
  it('prend le signalement sans le transformer en ticket tout seul', async () => {
    const response = await post('/api/origins/sentry/incidents', SIGNALEMENT)

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toMatchObject({ state: 'pending', storyId: null })
  })

  it('previent le board qu un incident est arrive', async () => {
    await post('/api/origins/sentry/incidents', SIGNALEMENT)

    expect(seen.filter((event) => event.name === 'incident.reported')).toHaveLength(1)
  })

  it('rend une source inconnue en 404', async () => {
    const response = await post('/api/origins/inconnue/incidents', SIGNALEMENT)

    expect(response.status).toBe(404)
  })

  it('refuse un signalement sans empreinte', async () => {
    const response = await post('/api/origins/sentry/incidents', { title: 'x', detail: 'y' })

    expect(response.status).toBe(422)
  })

  it('refuse un detail demesure plutot que de l avaler', async () => {
    const response = await post('/api/origins/sentry/incidents', {
      ...SIGNALEMENT,
      detail: 'a'.repeat(20001),
    })

    expect(response.status).toBe(422)
  })
})

describe('GET /api/incidents', () => {
  it('liste ce qui attend une decision', async () => {
    await post('/api/origins/sentry/incidents', SIGNALEMENT)

    const response = await api.request('/api/incidents?state=pending')

    await expect(response.json()).resolves.toHaveLength(1)
  })

  it('refuse un etat qui n existe pas', async () => {
    const response = await api.request('/api/incidents?state=peut-etre')

    expect(response.status).toBe(422)
  })
})

describe('POST /api/incidents/:id/accept', () => {
  it('cree la story et sa jumelle quand l humain accepte', async () => {
    const incident = (await (await post('/api/origins/sentry/incidents', SIGNALEMENT)).json()) as {
      id: number
    }

    const response = await post(`/api/incidents/${incident.id}/accept`, { epicId })

    expect(response.status).toBe(201)
    const accepted = (await response.json()) as { story: { id: number } }
    expect(stories.findTwin(accepted.story.id)).not.toBeNull()
  })

  it('rend un conflit quand l incident a deja ete tranche', async () => {
    const incident = (await (await post('/api/origins/sentry/incidents', SIGNALEMENT)).json()) as {
      id: number
    }
    await post(`/api/incidents/${incident.id}/accept`, { epicId })

    const response = await post(`/api/incidents/${incident.id}/accept`, { epicId })

    expect(response.status).toBe(409)
  })

  it('rend un incident inconnu en 404', async () => {
    const response = await post('/api/incidents/404/accept', { epicId })

    expect(response.status).toBe(404)
  })

  it('refuse une acceptation qui ne dit pas dans quelle epique ranger la story', async () => {
    const incident = (await (await post('/api/origins/sentry/incidents', SIGNALEMENT)).json()) as {
      id: number
    }

    const response = await post(`/api/incidents/${incident.id}/accept`, {})

    expect(response.status).toBe(422)
  })
})

describe('POST /api/incidents/:id/refuse', () => {
  it('refuse en gardant la raison', async () => {
    const incident = (await (await post('/api/origins/sentry/incidents', SIGNALEMENT)).json()) as {
      id: number
    }

    const response = await post(`/api/incidents/${incident.id}/refuse`, { reason: 'comportement attendu' })

    await expect(response.json()).resolves.toMatchObject({
      state: 'refused',
      refusalReason: 'comportement attendu',
    })
  })

  it('exige une raison', async () => {
    const incident = (await (await post('/api/origins/sentry/incidents', SIGNALEMENT)).json()) as {
      id: number
    }

    const response = await post(`/api/incidents/${incident.id}/refuse`, { reason: '' })

    expect(response.status).toBe(422)
  })
})
