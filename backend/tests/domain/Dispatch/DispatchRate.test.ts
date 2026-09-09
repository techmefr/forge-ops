import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createDispatcher, type Dispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { DEFAULT_DISPATCH_RATE } from '../../../src/domain/Dispatch/DispatchRate.js'
import { DispatchTooFastError } from '../../../src/domain/Dispatch/DispatchViolation.js'

let db: Database.Database
let stories: StoryRepository
let dispatcher: Dispatcher
let now: number
let launches: number
let storyIds: number[]

function build(rate = DEFAULT_DISPATCH_RATE): Dispatcher {
  return createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db),
    sessions: createAgentSessionRepository(db),
    budget: createBudgetRepository(db),
    runner: {
      launch: () => {
        launches += 1
        return Promise.resolve({ claudeSessionId: `session-${launches}` })
      },
    },
    concurrencyCap: 50,
    claudeCodeVersion: 'test',
    rate,
    clock: () => now,
  })
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  now = 1_000_000
  launches = 0
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  storyIds = Array.from({ length: 12 }, (unused, index) =>
    stories.writeStory({ epicId: epic.id, title: `story ${index}`, body: 'en tant que...' }).id,
  )
  dispatcher = build()
})

async function dispatchNext(index: number): Promise<void> {
  await dispatcher.dispatch({ storyId: storyIds[index] ?? 0, phase: 'spec' })
}

describe('le dispatch a un debit plafonne', () => {
  it('laisse passer une rafale qui reste dans le seau', async () => {
    for (let index = 0; index < DEFAULT_DISPATCH_RATE.burst; index += 1) {
      await dispatchNext(index)
    }

    expect(launches).toBe(DEFAULT_DISPATCH_RATE.burst)
  })

  it('refuse le lancement de trop, sans lancer quoi que ce soit', async () => {
    for (let index = 0; index < DEFAULT_DISPATCH_RATE.burst; index += 1) {
      await dispatchNext(index)
    }

    await expect(dispatchNext(DEFAULT_DISPATCH_RATE.burst)).rejects.toBeInstanceOf(DispatchTooFastError)
    expect(launches).toBe(DEFAULT_DISPATCH_RATE.burst)
  })

  it('rouvre le seau une fois la fenetre passee', async () => {
    for (let index = 0; index < DEFAULT_DISPATCH_RATE.burst; index += 1) {
      await dispatchNext(index)
    }
    now += DEFAULT_DISPATCH_RATE.windowMs + 1

    await dispatchNext(DEFAULT_DISPATCH_RATE.burst)

    expect(launches).toBe(DEFAULT_DISPATCH_RATE.burst + 1)
  })

  it('ne rouvre pas le seau avant la fin de la fenetre', async () => {
    for (let index = 0; index < DEFAULT_DISPATCH_RATE.burst; index += 1) {
      await dispatchNext(index)
    }
    now += DEFAULT_DISPATCH_RATE.windowMs - 1

    await expect(dispatchNext(DEFAULT_DISPATCH_RATE.burst)).rejects.toBeInstanceOf(DispatchTooFastError)
  })

  it('compte le debit sur tout le board, pas story par story', async () => {
    dispatcher = build({ burst: 2, windowMs: 60_000 })

    await dispatchNext(0)
    await dispatchNext(1)

    await expect(dispatchNext(2)).rejects.toBeInstanceOf(DispatchTooFastError)
  })

  it('ne consomme pas de jeton quand le lancement a ete refuse pour une autre raison', async () => {
    dispatcher = build({ burst: 2, windowMs: 60_000 })

    await dispatcher.dispatch({ storyId: storyIds[0] ?? 0, phase: 'code' }).catch(() => null)
    await dispatchNext(1)
    await dispatchNext(2)

    expect(launches).toBe(2)
  })
})
