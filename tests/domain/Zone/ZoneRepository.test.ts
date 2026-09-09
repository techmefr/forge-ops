import type Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import type { ZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import { createZoneRepository } from '../../../src/domain/Zone/ZoneRepository.js'
import {
  ZoneNotFoundError,
  ZonePrefixRequiredError,
} from '../../../src/domain/Zone/ZoneViolation.js'
import { openDatabase } from '../../../src/technical/Database/Connection.js'

let db: Database.Database
let zones: ZoneRepository
let projectId: number
let storyId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const sessions = createAgentSessionRepository(db)
  zones = createZoneRepository(db)
  const project = stories.createProject({
    slug: 'ps',
    name: 'Panier',
    repositoryUrl: 'git@example.com:ps.git',
    integrationBranch: 'main',
    colour: '#8B5CFF',
  })
  projectId = project.id
  const epic = stories.createEpic({
    projectId,
    title: 'Panier',
    businessIntent: 'Retrouver son panier',
  })
  const story = stories.writeStory({ epicId: epic.id, title: 'Panier persistant', body: 'corps' })
  storyId = story.id
  sessions.registerSession({
    storyId,
    claudeSessionId: 'session-dev-2',
    phase: 'code',
    agentName: 'claude-dev-2',
    claudeCodeVersion: '2.1.224',
  })
  sessions.recordFileTouch({
    claudeSessionId: 'session-dev-2',
    path: 'services/cart/CartService.ts',
  })
  sessions.recordFileTouch({
    claudeSessionId: 'session-dev-2',
    path: 'services/cart/CartTotals.ts',
  })
  sessions.recordFileTouch({ claudeSessionId: 'session-dev-2', path: 'web/checkout/CartPage.vue' })
})

describe('declareZone', () => {
  it('declares a zone with its colour', () => {
    const zone = zones.declareZone({
      projectId,
      pathPrefix: 'services/cart',
      name: 'Panier',
      colour: '#8B5CFF',
    })

    expect(zone.pathPrefix).toBe('services/cart')
    expect(zone.summary).toBeNull()
  })

  it('refuses a blank prefix', () => {
    expect(() =>
      zones.declareZone({ projectId, pathPrefix: '  ', name: 'Panier', colour: '#8B5CFF' }),
    ).toThrow(ZonePrefixRequiredError)
  })
})

describe('summariseZone', () => {
  it('attaches the generated summary to the zone', () => {
    zones.declareZone({ projectId, pathPrefix: 'services/cart', name: 'Panier', colour: '#8B5CFF' })

    expect(zones.summariseZone('services/cart', 'Detient l etat du panier').summary).toBe(
      'Detient l etat du panier',
    )
  })

  it('refuses a zone nobody declared', () => {
    expect(() => zones.summariseZone('services/ghost', 'rien')).toThrow(ZoneNotFoundError)
  })
})

describe('overview', () => {
  it('lists the files each zone carries with the story that touches them', () => {
    zones.declareZone({ projectId, pathPrefix: 'services/cart', name: 'Panier', colour: '#8B5CFF' })
    zones.declareZone({ projectId, pathPrefix: 'web/checkout', name: 'Tunnel', colour: '#00E0FF' })

    const overview = zones.overview(projectId)

    expect(overview.map((entry) => entry.zone.pathPrefix)).toEqual([
      'services/cart',
      'web/checkout',
    ])
    expect(overview[0]?.files.map((file) => file.path)).toEqual([
      'services/cart/CartService.ts',
      'services/cart/CartTotals.ts',
    ])
    expect(overview[0]?.files[0]?.agentName).toBe('claude-dev-2')
    expect(overview[0]?.storyCount).toBe(1)
  })

  it('leaves a declared zone in the overview even with no file touched', () => {
    zones.declareZone({ projectId, pathPrefix: 'infra/queues', name: 'Files', colour: '#22E67A' })

    expect(zones.overview(projectId)[0]?.files).toEqual([])
  })
})

describe('zoneOfPath', () => {
  it('attaches a path to the most precise zone', () => {
    zones.declareZone({ projectId, pathPrefix: 'services', name: 'Services', colour: '#22E67A' })
    zones.declareZone({ projectId, pathPrefix: 'services/cart', name: 'Panier', colour: '#8B5CFF' })

    expect(zones.zoneOfPath('services/cart/CartTotals.ts')?.pathPrefix).toBe('services/cart')
  })

  it('answers nothing for a path no zone covers', () => {
    expect(zones.zoneOfPath('scripts/seed.ts')).toBeNull()
  })
})
