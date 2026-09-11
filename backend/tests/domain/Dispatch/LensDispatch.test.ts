import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { createDispatcher, type Dispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import type { LaunchOrder, SessionRunner } from '../../../src/domain/Dispatch/Dispatch.js'
import { LensOutOfOrderError } from '../../../src/domain/Checkpoint/CheckpointViolation.js'
import { LensOutsideReviewError } from '../../../src/domain/Dispatch/DispatchViolation.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

let db: Database.Database
let stories: StoryRepository
let checkpoints: CheckpointRepository
let dispatcher: Dispatcher
let launched: LaunchOrder[]
let storyId: number

const BODY = [
  'En tant que gestionnaire, je veux voir la liste des mails du client',
  'afin de retrouver un echange sans ouvrir sa boite.',
  '',
  'La liste est paginee par vingt, du plus recent au plus ancien.',
  'Quand le client n a aucun mail, la page le dit.',
].join('\n')

function fakeRunner(): SessionRunner {
  let counter = 0
  return {
    launch: async (order) => {
      launched.push(order)
      counter += 1
      return { claudeSessionId: `fake-session-${counter}` }
    },
  }
}

function closeLastSession(): void {
  createAgentSessionRepository(db).closeSession(`fake-session-${launched.length}`, { exitCode: 0 })
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
  })
  launched = []
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' })
  const story = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails du client', body: BODY })
  storyId = story.id
  stories.writeTwin({ storyId, title: 'tests visualiser les mails', body: 'cas nominal et cas vide' })
  const criteria = createCriterionRepository(db)
  criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'la liste est paginee' })
  criteria.declareCriterion({ storyId, reference: 'AC-2', statement: 'le cas vide est annonce' })
  for (const name of ['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified'] as const) {
    checkpoints.proveCheckpoint({ storyId, name, evidencePath: `.claude/evidence/${name}.md` })
  }
  dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints,
    criteria,
    sessions: createAgentSessionRepository(db),
    budget: createBudgetRepository(db),
    foremerge: createForemergeRepository(db, { stories }),
    runner: fakeRunner(),
    concurrencyCap: 3,
    claudeCodeVersion: '2.1.224',
  })
})

describe('dispatching a review lens', () => {
  it('sends the reader that lens belongs to, not the generic reviewer', async () => {
    const dispatched = await dispatcher.dispatch({ storyId, phase: 'review', lens: 'quality' })

    expect(dispatched.agentName).toBe('elrond')
  })

  it('sends another reader for the security lens', async () => {
    await dispatcher.dispatch({ storyId, phase: 'review', lens: 'quality' })
    closeLastSession()
    checkpoints.passLens(storyId, 'quality')

    const dispatched = await dispatcher.dispatch({ storyId, phase: 'review', lens: 'security' })

    expect(dispatched.agentName).toBe('seraph')
  })

  it('names the lens in the prompt, so the reader knows what it reads', async () => {
    await dispatcher.dispatch({ storyId, phase: 'review', lens: 'quality' })

    expect(launched[0]?.prompt).toContain('quality')
  })

  it('marks the pass running, the board shows who reads what', async () => {
    await dispatcher.dispatch({ storyId, phase: 'review', lens: 'quality' })

    expect(checkpoints.reviewCascade(storyId)[0]).toMatchObject({
      lens: 'quality',
      state: 'running',
      agentName: 'elrond',
    })
  })

  it('refuses a lens whose turn has not come', async () => {
    await expect(
      dispatcher.dispatch({ storyId, phase: 'review', lens: 'accessibility' }),
    ).rejects.toThrow(LensOutOfOrderError)
  })

  it('burns no session on a lens whose turn has not come', async () => {
    await expect(
      dispatcher.dispatch({ storyId, phase: 'review', lens: 'accessibility' }),
    ).rejects.toThrow()

    expect(launched).toEqual([])
  })

  it('burns no session on a lens already passed', async () => {
    await dispatcher.dispatch({ storyId, phase: 'review', lens: 'quality' })
    closeLastSession()
    checkpoints.passLens(storyId, 'quality')
    launched = []

    await expect(dispatcher.dispatch({ storyId, phase: 'review', lens: 'quality' })).rejects.toThrow()
    expect(launched).toEqual([])
  })

  it('keeps the generic reviewer when no lens is asked for', async () => {
    const dispatched = await dispatcher.dispatch({ storyId, phase: 'review' })

    expect(dispatched.agentName).toBe('elrond')
  })

  it('leaves the cascade untouched when no lens is asked for', async () => {
    await dispatcher.dispatch({ storyId, phase: 'review' })

    expect(checkpoints.reviewCascade(storyId).every((pass) => pass.state === 'pending')).toBe(true)
  })

  it('refuses a lens on a phase that is not the review', async () => {
    await expect(dispatcher.dispatch({ storyId, phase: 'ship', lens: 'quality' })).rejects.toThrow(
      LensOutsideReviewError,
    )
  })
})
