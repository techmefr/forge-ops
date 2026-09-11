import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createDispatcher, type Dispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import {
  createForemergeRepository,
  type ForemergeRepository,
} from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { ScopeTakenError } from '../../../src/domain/Foremerge/ForemergeViolation.js'

const CORPS_ETOFFE = [
  'En tant que gestionnaire, je veux voir la liste des mails du client',
  'afin de retrouver un echange precis sans quitter le board.',
  'La liste est paginee, triee par date, et chaque ligne porte son expediteur.',
].join(' ')

let db: Database.Database
let stories: StoryRepository
let foremerge: ForemergeRepository
let dispatcher: Dispatcher
let first: number
let second: number

function fakeRunner() {
  let taken = 0
  return {
    launch: () => {
      taken += 1
      return Promise.resolve({ claudeSessionId: `0000000${taken}-1111-2222-3333-444455556666` })
    },
  }
}

function readyStory(title: string): number {
  const epic = stories.listEpics(1)[0]
  const story = stories.writeStory({ epicId: epic?.id ?? 1, title, body: CORPS_ETOFFE })
  stories.writeTwin({ storyId: story.id, title: `prouver ${title}`, body: CORPS_ETOFFE })
  const criteria = createCriterionRepository(db)
  criteria.declareCriterion({ storyId: story.id, reference: 'CA-1', statement: 'la liste est paginee' })
  criteria.declareCriterion({ storyId: story.id, reference: 'CA-2', statement: 'une page vide est refusee' })
  createCheckpointRepository(db, {
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
  }).proveCheckpoint({
    storyId: story.id,
    name: 'spec_done',
    evidencePath: `.claude/evidence/${story.reference}/spec.md`,
  })
  return story.id
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails',
  })
  foremerge = createForemergeRepository(db, { stories })
  dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db, {
      takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    }),
    criteria: createCriterionRepository(db),
    sessions: createAgentSessionRepository(db),
    budget: createBudgetRepository(db),
    foremerge,
    runner: fakeRunner(),
    concurrencyCap: 5,
    claudeCodeVersion: '2.1.224',
  })
  first = readyStory('visualiser les mails')
  second = readyStory('supprimer les mails')
})

describe('the scope gate', () => {
  it('lets a story launch on a scope nobody holds', async () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src/domain/Mail', symbols: [] })

    await expect(dispatcher.dispatch({ storyId: first, phase: 'architecture' })).resolves.toMatchObject({
      storyId: first,
    })
  })

  it('lets a story launch when it has reserved nothing at all', async () => {
    await expect(dispatcher.dispatch({ storyId: first, phase: 'architecture' })).resolves.toMatchObject({
      storyId: first,
    })
  })

  it('refuses a launch whose scope another story is holding', async () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    db.prepare('INSERT INTO scope_reservation (story_id, path_prefix, symbols) VALUES (?, ?, ?)').run(
      second,
      'backend/src/domain/Mail',
      '',
    )

    await expect(dispatcher.dispatch({ storyId: second, phase: 'architecture' })).rejects.toThrow(
      ScopeTakenError,
    )
  })

  it('refuses a launch whose scope swallows a narrower prefix another story is holding', async () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src/domain/Mail', symbols: [] })
    db.prepare('INSERT INTO scope_reservation (story_id, path_prefix, symbols) VALUES (?, ?, ?)').run(
      second,
      'backend/src',
      '',
    )

    await expect(dispatcher.dispatch({ storyId: second, phase: 'architecture' })).rejects.toThrow(
      ScopeTakenError,
    )
  })

  it('names the story holding the scope, so the human knows who to wait for', async () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    db.prepare('INSERT INTO scope_reservation (story_id, path_prefix, symbols) VALUES (?, ?, ?)').run(
      second,
      'backend/src/domain/Mail',
      '',
    )

    await expect(dispatcher.dispatch({ storyId: second, phase: 'architecture' })).rejects.toThrow(
      /FORGE-1/,
    )
  })

  it('does not gate the writing of a story, which touches no code', async () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    db.prepare('INSERT INTO scope_reservation (story_id, path_prefix, symbols) VALUES (?, ?, ?)').run(
      second,
      'backend/src/domain/Mail',
      '',
    )

    await expect(dispatcher.dispatch({ storyId: second, phase: 'spec' })).resolves.toMatchObject({
      storyId: second,
    })
  })

  it('lets the launch through once the holder has released its scope', async () => {
    foremerge.reserve({ storyId: first, pathPrefix: 'backend/src', symbols: [] })
    db.prepare('INSERT INTO scope_reservation (story_id, path_prefix, symbols) VALUES (?, ?, ?)').run(
      second,
      'backend/src/domain/Mail',
      '',
    )
    foremerge.release(first)

    await expect(dispatcher.dispatch({ storyId: second, phase: 'architecture' })).resolves.toMatchObject({
      storyId: second,
    })
  })
})
