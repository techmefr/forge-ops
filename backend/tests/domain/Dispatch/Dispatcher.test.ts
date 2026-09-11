import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createDispatcher, type Dispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import type { LaunchOrder, SessionRunner } from '../../../src/domain/Dispatch/Dispatch.js'
import {
  FleetSaturatedError,
  PhaseNotReadyError,
  SessionAlreadyRunningError,
  StoryBlockedError,
} from '../../../src/domain/Dispatch/DispatchViolation.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

let db: Database.Database
let stories: StoryRepository
let sessions: AgentSessionRepository
let dispatcher: Dispatcher
let launched: LaunchOrder[]
let storyId: number
let epicId: number

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

function buildDispatcher(concurrencyCap = 3): Dispatcher {
  return createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES, takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) }),
    criteria: createCriterionRepository(db),
    sessions,
    budget: createBudgetRepository(db),
    foremerge: createForemergeRepository(db, { stories }),
    runner: fakeRunner(),
    concurrencyCap,
    claudeCodeVersion: '2.1.224',
  })
}

const CORPS_ETOFFE = [
  'En tant que gestionnaire, je veux voir la liste des mails du client',
  'afin de retrouver un echange sans ouvrir sa boite.',
  '',
  'La liste est paginee par vingt, du plus recent au plus ancien.',
  'Quand le client n a aucun mail, la page le dit.',
].join('\n')

function writeReadyStory(title: string): number {
  const story = stories.writeStory({ epicId, title: `${title} pour le client concerne`, body: CORPS_ETOFFE })
  stories.writeTwin({ storyId: story.id, title: `tests ${title}`, body: 'cas...' })
  const criteria = createCriterionRepository(db)
  criteria.declareCriterion({
    storyId: story.id,
    reference: 'AC-1',
    statement: 'le comportement attendu',
  })
  criteria.declareCriterion({
    storyId: story.id,
    reference: 'AC-2',
    statement: 'le cas vide est annonce',
  })
  return story.id
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  sessions = createAgentSessionRepository(db)
  launched = []
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  epicId = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer' }).id
  storyId = writeReadyStory('visualiser les mails')
  dispatcher = buildDispatcher()
})

describe('dispatch', () => {
  it('launches the spec phase and registers the session it obtained', async () => {
    const dispatched = await dispatcher.dispatch({ storyId, phase: 'spec' })

    expect(dispatched).toMatchObject({ phase: 'spec', agentName: 'architecte', storyId })
    expect(sessions.findByClaudeSessionId(dispatched.claudeSessionId)).toMatchObject({
      storyId,
      phase: 'spec',
      lifecycle: 'starting',
    })
  })

  it('hands the runner the story reference and a prompt that names the phase', async () => {
    await dispatcher.dispatch({ storyId, phase: 'spec' })

    expect(launched).toHaveLength(1)
    expect(launched[0]).toMatchObject({ reference: 'FORGE-1', phase: 'spec' })
    expect(launched[0]?.prompt).toContain('FORGE-1')
  })

  it('refuses a phase whose checkpoints are not proven yet', async () => {
    await expect(dispatcher.dispatch({ storyId, phase: 'code' })).rejects.toThrow(PhaseNotReadyError)
  })

  it('names every missing checkpoint in the refusal', async () => {
    await expect(dispatcher.dispatch({ storyId, phase: 'code' })).rejects.toThrow(/spec_done/)
  })

  it('refuses a second session on the same story while the first still runs', async () => {
    await dispatcher.dispatch({ storyId, phase: 'spec' })

    await expect(dispatcher.dispatch({ storyId, phase: 'spec' })).rejects.toThrow(SessionAlreadyRunningError)
  })

  it('lets a new phase start once the previous session is finished', async () => {
    const first = await dispatcher.dispatch({ storyId, phase: 'spec' })
    sessions.updateLifecycle(first.claudeSessionId, 'finished')

    await expect(dispatcher.dispatch({ storyId, phase: 'spec' })).resolves.toMatchObject({ phase: 'spec' })
  })

  it('refuses to launch beyond the concurrency cap', async () => {
    dispatcher = buildDispatcher(2)
    await dispatcher.dispatch({ storyId, phase: 'spec' })
    await dispatcher.dispatch({ storyId: writeReadyStory('creer un mail'), phase: 'spec' })

    await expect(
      dispatcher.dispatch({ storyId: writeReadyStory('supprimer un mail'), phase: 'spec' }),
    ).rejects.toThrow(FleetSaturatedError)
  })

  it('refuses a story still waiting on a blocking dependency', async () => {
    const blocking = writeReadyStory('authentifier le client')
    stories.addDependency({ blockedStoryId: storyId, blockingStoryId: blocking })

    await expect(dispatcher.dispatch({ storyId, phase: 'spec' })).rejects.toThrow(StoryBlockedError)
  })

  it('does not register a session when the runner never launched', async () => {
    const failing = createDispatcher({
      database: db,
      stories,
      checkpoints: createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES, takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) }),
      criteria: createCriterionRepository(db),
      sessions,
      budget: createBudgetRepository(db),
    foremerge: createForemergeRepository(db, { stories }),
      runner: {
        launch: () => Promise.reject(new Error('daemon absent')),
      },
      concurrencyCap: 3,
      claudeCodeVersion: '2.1.224',
    })

    await expect(failing.dispatch({ storyId, phase: 'spec' })).rejects.toThrow('daemon absent')
    expect(failing.countRunning()).toBe(0)
  })
})

describe('countRunning', () => {
  it('counts only the sessions that are still working', async () => {
    const first = await dispatcher.dispatch({ storyId, phase: 'spec' })
    await dispatcher.dispatch({ storyId: writeReadyStory('creer un mail'), phase: 'spec' })
    sessions.updateLifecycle(first.claudeSessionId, 'finished')

    expect(dispatcher.countRunning()).toBe(1)
  })
})
