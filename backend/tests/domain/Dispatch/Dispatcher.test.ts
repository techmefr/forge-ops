import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { createForgeCardRepository, type ForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
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
import { createWorkflowRepository } from '../../../src/domain/Workflow/WorkflowRepository.js'
import { SEED_WORKFLOW, WORKFLOW_CONFIG_KEY } from '../../../src/domain/Workflow/Workflow.js'
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

  it('follows the persisted workflow for the agent, command and preprompt', async () => {
    const workflow = createWorkflowRepository(db)
    const stored = SEED_WORKFLOW.map((entry) =>
      entry.phase === 'spec'
        ? { ...entry, agentName: 'oxydis', command: 'CUSTOM.md', preprompt: 'ecris court' }
        : entry,
    )
    db.prepare('INSERT INTO board_setting (key, value) VALUES (?, ?)').run(WORKFLOW_CONFIG_KEY, JSON.stringify(stored))
    const configured = createDispatcher({
      database: db,
      stories,
      checkpoints: createCheckpointRepository(db, {
        ...PERMISSIVE_CHECKPOINT_GATES,
        takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
      }),
      criteria: createCriterionRepository(db),
      sessions,
      budget: createBudgetRepository(db),
      foremerge: createForemergeRepository(db, { stories }),
      runner: fakeRunner(),
      concurrencyCap: 3,
      claudeCodeVersion: '2.1.224',
      workflow,
    })

    const dispatched = await configured.dispatch({ storyId, phase: 'spec' })

    expect(dispatched.agentName).toBe('oxydis')
    expect(dispatched.prompt).toContain('ecris court')
    expect(dispatched.prompt).toContain('CUSTOM.md')
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

describe('dispatch avec une forge card', () => {
  let cards: ForgeCardRepository

  function buildDispatcherWithCards(): Dispatcher {
    return createDispatcher({
      database: db,
      stories,
      checkpoints: createCheckpointRepository(db, {
        ...PERMISSIVE_CHECKPOINT_GATES,
        takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
      }),
      criteria: createCriterionRepository(db),
      sessions,
      budget: createBudgetRepository(db),
      foremerge: createForemergeRepository(db, { stories }),
      runner: fakeRunner(),
      concurrencyCap: 3,
      claudeCodeVersion: '2.1.224',
      forgeCards: cards,
    })
  }

  beforeEach(() => {
    cards = createForgeCardRepository(db)
  })

  it('nomme la reference de la carte et les stories qu elle porte', async () => {
    const second = writeReadyStory('creer un mail')
    stories.sendToBacklog(storyId)
    stories.sendToBacklog(second)
    const card = cards.createForgeCard({ storyIds: [storyId, second] })
    const withCards = buildDispatcherWithCards()

    await withCards.dispatch({ storyId, phase: 'spec' })

    const storyReference = stories.findStory(storyId).reference
    const secondReference = stories.findStory(second).reference
    expect(launched.at(-1)).toMatchObject({
      reference: `${card.reference} (${storyReference}, ${secondReference})`,
      forgeCardId: card.id,
    })
  })

  it('ne demande pas de reprise lors du tout premier lancement de la carte', async () => {
    stories.sendToBacklog(storyId)
    cards.createForgeCard({ storyIds: [storyId] })
    const withCards = buildDispatcherWithCards()

    await withCards.dispatch({ storyId, phase: 'spec' })

    expect(launched.at(-1)?.resumeSessionId).toBeUndefined()
  })

  it('reprend la session claude enregistree sur la carte au tour suivant', async () => {
    stories.sendToBacklog(storyId)
    const card = cards.createForgeCard({ storyIds: [storyId] })
    const withCards = buildDispatcherWithCards()

    const first = await withCards.dispatch({ storyId, phase: 'spec' })
    sessions.updateLifecycle(first.claudeSessionId, 'finished')

    const second = await withCards.dispatch({ storyId, phase: 'spec' })

    expect(launched.at(-1)?.resumeSessionId).toBe(first.claudeSessionId)
    expect(cards.findForgeCard(card.id)).toMatchObject({
      claudeSessionId: second.claudeSessionId,
      currentPhase: 'spec',
    })
  })

  it('bloque un dispatch sur une story soeur portee par la meme carte ouverte', async () => {
    const second = writeReadyStory('creer un mail')
    stories.sendToBacklog(storyId)
    stories.sendToBacklog(second)
    cards.createForgeCard({ storyIds: [storyId, second] })
    const withCards = buildDispatcherWithCards()

    await withCards.dispatch({ storyId, phase: 'spec' })

    await expect(withCards.dispatch({ storyId: second, phase: 'spec' })).rejects.toThrow(
      SessionAlreadyRunningError,
    )
  })

  it('garde le comportement par story quand aucune carte ne porte encore la story', async () => {
    const withCards = buildDispatcherWithCards()

    const dispatched = await withCards.dispatch({ storyId, phase: 'spec' })

    expect(dispatched).toMatchObject({ phase: 'spec', storyId })
    expect(launched.at(-1)).toMatchObject({ reference: stories.findStory(storyId).reference })
    expect(launched.at(-1)?.forgeCardId).toBeUndefined()
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

describe('resuming a session of the card', () => {
  function buildResumingDispatcher(abandoned: string[], register = sessions): Dispatcher {
    return createDispatcher({
      database: db,
      stories,
      checkpoints: createCheckpointRepository(db, {
        ...PERMISSIVE_CHECKPOINT_GATES,
        takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
      }),
      criteria: createCriterionRepository(db),
      sessions: register,
      budget: createBudgetRepository(db),
      foremerge: createForemergeRepository(db, { stories }),
      runner: {
        launch: async () => ({ claudeSessionId: 'resumed-session' }),
        abandon: (id) => abandoned.push(id),
      },
      concurrencyCap: 3,
      claudeCodeVersion: '2.1.224',
    })
  }

  it('reuses the row of the resumed session instead of failing on the unique session id', async () => {
    const resuming = buildResumingDispatcher([])
    await resuming.dispatch({ storyId, phase: 'spec' })
    sessions.recordUsage('resumed-session', { costUsd: 0.069, inputTokens: 10, outputTokens: 5 })
    sessions.closeSession('resumed-session', { exitCode: 0 })

    await resuming.dispatch({ storyId, phase: 'spec' })

    const rows = db.prepare('SELECT lifecycle, outcome, phase, ended_at FROM agent_session').all()
    expect(rows).toEqual([{ lifecycle: 'starting', outcome: null, phase: 'spec', ended_at: null }])
  })

  it('only grows the cost of a resumed session', async () => {
    const resuming = buildResumingDispatcher([])
    await resuming.dispatch({ storyId, phase: 'spec' })
    sessions.recordUsage('resumed-session', { costUsd: 0.069, inputTokens: 10, outputTokens: 5 })
    sessions.closeSession('resumed-session', { exitCode: 0 })
    await resuming.dispatch({ storyId, phase: 'spec' })

    const afterResume = sessions.recordUsage('resumed-session', { costUsd: 0.022, inputTokens: 4, outputTokens: 2 })

    expect(afterResume.costUsd).toBeCloseTo(0.091, 6)
    expect(sessions.sumUsage(storyId).costUsd).toBeCloseTo(0.091, 6)
  })

  it('abandons the started process when the session cannot be registered', async () => {
    const abandoned: string[] = []
    const failing = {
      ...sessions,
      registerSession: () => {
        throw new Error('registration refused')
      },
    }
    const resuming = buildResumingDispatcher(abandoned, failing)

    await expect(resuming.dispatch({ storyId, phase: 'spec' })).rejects.toThrow('registration refused')

    expect(abandoned).toEqual(['resumed-session'])
  })
})

describe('a session that only waits for the human', () => {
  function buildAbandoningDispatcher(abandoned: string[], concurrencyCap = 3): Dispatcher {
    let counter = 0
    return createDispatcher({
      database: db,
      stories,
      checkpoints: createCheckpointRepository(db, {
        ...PERMISSIVE_CHECKPOINT_GATES,
        takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
      }),
      criteria: createCriterionRepository(db),
      sessions,
      budget: createBudgetRepository(db),
      foremerge: createForemergeRepository(db, { stories }),
      runner: {
        launch: async () => {
          counter += 1
          return { claudeSessionId: `waiting-session-${counter}` }
        },
        abandon: (id) => abandoned.push(id),
      },
      concurrencyCap,
      claudeCodeVersion: '2.1.224',
    })
  }

  it('is hung up and closed as succeeded when the card moves on', async () => {
    const abandoned: string[] = []
    const moving = buildAbandoningDispatcher(abandoned)
    const first = await moving.dispatch({ storyId, phase: 'spec' })
    sessions.updateLifecycle(first.claudeSessionId, 'awaiting_human')

    const second = await moving.dispatch({ storyId, phase: 'spec' })

    expect(second.claudeSessionId).not.toBe(first.claudeSessionId)
    expect(abandoned).toEqual([first.claudeSessionId])
    expect(db.prepare('SELECT lifecycle, outcome FROM agent_session WHERE claude_session_id = ?').get(first.claudeSessionId)).toEqual({
      lifecycle: 'finished',
      outcome: 'succeeded',
    })
  })

  it('does not hold the last slot of the cap against its own card', async () => {
    const moving = buildAbandoningDispatcher([], 1)
    const first = await moving.dispatch({ storyId, phase: 'spec' })
    sessions.updateLifecycle(first.claudeSessionId, 'awaiting_human')

    await expect(moving.dispatch({ storyId, phase: 'spec' })).resolves.toBeDefined()
  })

  it('still refuses while the agent is working', async () => {
    const moving = buildAbandoningDispatcher([])
    const first = await moving.dispatch({ storyId, phase: 'spec' })
    sessions.updateLifecycle(first.claudeSessionId, 'working')

    await expect(moving.dispatch({ storyId, phase: 'spec' })).rejects.toThrow(SessionAlreadyRunningError)
  })

  it('keeps counting as a running session for the cap and the counters', async () => {
    const moving = buildAbandoningDispatcher([])
    const first = await moving.dispatch({ storyId, phase: 'spec' })
    sessions.updateLifecycle(first.claudeSessionId, 'awaiting_human')

    expect(moving.countRunning()).toBe(1)
  })
})
