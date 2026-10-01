import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import {
  createAutopilotRepository,
  type AutopilotRepository,
} from '../../../src/domain/Autopilot/AutopilotRepository.js'
import { DEFAULT_AUTOPILOT } from '../../../../contract/AutopilotContract.js'

let db: Database.Database
let autopilot: AutopilotRepository
let projectId: number
let cardId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  const forgeCards = createForgeCardRepository(db)
  const stories = createStoryRepository(db, { onBacklog: (story) => forgeCards.attachCardToStory(story.id) })
  autopilot = createAutopilotRepository(db)
  projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  const epicId = stories.createEpic({ projectId, title: 'CRUD Mail', businessIntent: 'manage' }).id
  const story = stories.writeStory({ epicId, title: 'see the mails for the customer', body: 'body' })
  stories.writeTwin({ storyId: story.id, title: 'tests', body: 'cases' })
  stories.sendToBacklog(story.id)
  cardId = forgeCards.openCardOfStory(story.id)?.id ?? 0
})

describe('the autopilot settings of a project', () => {
  it('runs automatically by default, launching and publishing, but never merging', () => {
    expect(autopilot.settingsOf(projectId)).toEqual(DEFAULT_AUTOPILOT)
    expect(DEFAULT_AUTOPILOT).toEqual({ enabled: true, autoLaunch: true, autoPublish: true, autoMerge: false })
  })

  it('keeps what a project settled, per project', () => {
    autopilot.settle(projectId, { enabled: true, autoLaunch: false, autoPublish: false, autoMerge: true })

    expect(autopilot.settingsOf(projectId)).toEqual({
      enabled: true,
      autoLaunch: false,
      autoPublish: false,
      autoMerge: true,
    })
    expect(autopilot.settingsOf(projectId + 1)).toEqual(DEFAULT_AUTOPILOT)
  })
})

describe('the autopilot state of a card', () => {
  it('starts blank', () => {
    expect(autopilot.cardOf(cardId)).toMatchObject({ attempts: 0, advances: 0, state: null, pending: null })
  })

  it('keeps a patch and merges the next one', () => {
    autopilot.patchCard(cardId, { stepKey: 'spec', attempts: 1 })
    autopilot.patchCard(cardId, { pending: 'retry', feedback: 'why' })

    expect(autopilot.cardOf(cardId)).toMatchObject({ stepKey: 'spec', attempts: 1, pending: 'retry', feedback: 'why' })
  })

  it('lists the pending cards but not the red ones', () => {
    autopilot.patchCard(cardId, { pending: 'advance' })
    expect(autopilot.listPending().map((record) => record.forgeCardId)).toEqual([cardId])

    autopilot.patchCard(cardId, { state: 'red', reason: 'nope' })
    expect(autopilot.listPending()).toEqual([])
  })

  it('forgets a card when a human acts on it', () => {
    autopilot.patchCard(cardId, { state: 'red', reason: 'nope', attempts: 2 })

    autopilot.resetCard(cardId)

    expect(autopilot.cardOf(cardId)).toMatchObject({ attempts: 0, state: null })
  })
})
