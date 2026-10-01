import { beforeEach, describe, expect, it } from 'vitest'
import type { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createStepEntry } from '../../../src/domain/Dispatch/StepEntry.js'
import { createDispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import {
  createWorkflowColumnRepository,
  type WorkflowColumnRepository,
} from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import { createForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import {
  createForgeBoardRepository,
  type ForgeBoardRepository,
} from '../../../src/domain/ForgeCard/ForgeBoardRepository.js'
import { createForgeCardMover, type ForgeCardMover } from '../../../src/domain/ForgeCard/ForgeCardMover.js'
import { createForgeBoardApi } from '../../../src/domain/ForgeCard/ForgeBoardApi.js'
import {
  DoneIsEarnedError,
  DoneIsFinalError,
  LaunchNeedsAStepError,
  StepBusyError,
  UnknownStepKeyError,
} from '../../../src/domain/ForgeCard/ForgeCardViolation.js'
import { StoryTooThinError } from '../../../src/domain/Dispatch/DispatchViolation.js'
import type { LaunchOrder, SessionRunner } from '../../../src/domain/Dispatch/Dispatch.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'
import type { WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'
import type { ForgeCardMoved, ForgeCardView } from '../../../../contract/ForgeCardContract.js'

const AGENT_STEP: WorkflowColumnDraft = {
  label: 'Spec',
  colour: 'acc',
  provider: 'claude',
  model: 'claude-sonnet-5',
  effort: 'high',
  agentName: '',
  command: '',
  preprompt: '',
  autoStart: true,
}

const MANUAL_STEP: WorkflowColumnDraft = { ...AGENT_STEP, label: 'Security audit', autoStart: false }

const HUMAN_STEP: WorkflowColumnDraft = {
  ...AGENT_STEP,
  label: 'Validation',
  provider: 'human',
  model: '',
  effort: '',
  autoStart: false,
}

const BODY = [
  'As a manager, I want to see the mails of a customer',
  'so that I find an exchange without opening the mailbox.',
  '',
  'The list is paginated by twenty, newest first.',
  'When the customer has no mail, the page says so.',
].join('\n')

let db: Database.Database
let stories: StoryRepository
let columns: WorkflowColumnRepository
let board: ForgeBoardRepository
let mover: ForgeCardMover
let api: Hono
let launched: LaunchOrder[]
let published: string[]
let projectId: number
let epicId: number
let storyId: number

function fakeRunner(): SessionRunner {
  let counter = 0
  return {
    launch: async (order) => {
      launched.push(order)
      counter += 1
      await Promise.resolve()
      return { claudeSessionId: `session-${counter}` }
    },
  }
}

function backlogStory(title: string): number {
  const story = stories.writeStory({ epicId, title: `${title} for the customer concerned`, body: BODY })
  stories.writeTwin({ storyId: story.id, title: `tests ${title}`, body: 'cases...' })
  stories.sendToBacklog(story.id)
  return story.id
}

function cardOf(id: number): ForgeCardView {
  const found = board.list(projectId).find((card) => card.storyId === id)
  if (found === undefined) {
    throw new Error(`no card for story ${id}`)
  }
  return found
}

async function ask(path: string, method = 'GET', body?: unknown): Promise<Response> {
  return (await api.request(path, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })) as Response
}

beforeEach(() => {
  db = openDatabase(':memory:')
  const forgeCards = createForgeCardRepository(db)
  stories = createStoryRepository(db, { onBacklog: (story) => forgeCards.attachCardToStory(story.id) })
  columns = createWorkflowColumnRepository(db)
  launched = []
  published = []
  projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  epicId = stories.createEpic({ projectId, title: 'CRUD Mail', businessIntent: 'manage' }).id
  storyId = backlogStory('see the mails')
  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db, {
      ...PERMISSIVE_CHECKPOINT_GATES,
      takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    }),
    criteria: createCriterionRepository(db),
    sessions: createAgentSessionRepository(db),
    budget: createBudgetRepository(db),
    foremerge: createForemergeRepository(db, { stories }),
    runner: fakeRunner(),
    concurrencyCap: 5,
    claudeCodeVersion: '2.1.224',
  })
  board = createForgeBoardRepository(db, { forgeCards, columns })
  mover = createForgeCardMover({
    board,
    forgeCards,
    stories,
    columns,
    enterStep: createStepEntry({ dispatcher, columns }),
    launchStep: (entry) => dispatcher.dispatch(entry),
  })
  api = createForgeBoardApi({
    board,
    mover,
    closer: {
      close: () => {
        throw new Error('unused')
      },
    },
    forgeCards,
    stories,
    events: { publish: (event) => published.push(event.name) },
  })
})

describe('the cards of a project', () => {
  it('gives every story of the project a card, backlog first', () => {
    const cards = board.list(projectId)

    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ storyId, stepKey: 'backlog', status: 'idle', subjectId: epicId, costUsd: 0 })
  })

  it('hides the cards of a deleted subject and shows them again once restored', () => {
    expect(board.list(projectId)).toHaveLength(1)

    stories.epics.softDelete(epicId, 'gaetan')
    expect(board.list(projectId)).toHaveLength(0)

    stories.epics.restore(epicId, 'gaetan')
    expect(board.list(projectId)).toHaveLength(1)
  })

  it('creates the card once, not at each reading', () => {
    board.list(projectId)
    board.list(projectId)

    expect(db.prepare('SELECT COUNT(*) AS total FROM forge_card').get()).toEqual({ total: 1 })
  })

  it('leaves the stories still being written off the board', () => {
    stories.writeStory({ epicId, title: 'still a draft', body: BODY })

    expect(board.list(projectId)).toHaveLength(1)
  })

  it('puts a done story in the done column', () => {
    stories.markDoneAndUnblock(storyId)

    expect(board.list(projectId)[0]).toMatchObject({ stepKey: 'done', status: 'done' })
  })

  it('does not list the cards of another project', () => {
    const other = stories.createProject({
      slug: 'other',
      name: 'Other',
      repositoryUrl: 'git@github.com:techmefr/other.git',
      integrationBranch: 'main',
      colour: '#00ff00',
    })

    expect(board.list(other.id)).toEqual([])
  })
})

describe('moving a card', () => {
  it('starts exactly one session when a card enters an auto step', async () => {
    columns.create(projectId, AGENT_STEP)
    const card = cardOf(storyId)

    const moved = await mover.move(card.id, 'spec')

    expect(moved.started).toBe(true)
    expect(moved.card).toMatchObject({ stepKey: 'spec', status: 'running' })
    expect(launched).toHaveLength(1)
  })

  it('starts one session even when the card is dropped twice at once', async () => {
    columns.create(projectId, AGENT_STEP)
    const card = cardOf(storyId)

    const answers = await Promise.allSettled([mover.move(card.id, 'spec'), mover.move(card.id, 'spec')])

    expect(launched).toHaveLength(1)
    const started = answers.flatMap((answer) => (answer.status === 'fulfilled' ? [answer.value.started] : []))
    expect(started.filter(Boolean)).toHaveLength(1)
  })

  it('starts nothing when the same card is dropped again after the first drop', async () => {
    columns.create(projectId, AGENT_STEP)
    const card = cardOf(storyId)
    await mover.move(card.id, 'spec')

    const again = await mover.move(card.id, 'spec')

    expect(again.started).toBe(false)
    expect(launched).toHaveLength(1)
  })

  it('never starts an agent in a human step', async () => {
    columns.create(projectId, HUMAN_STEP)

    const moved = await mover.move(cardOf(storyId).id, 'validation')

    expect(moved.started).toBe(false)
    expect(moved.card).toMatchObject({ stepKey: 'validation', status: 'human_review' })
    expect(launched).toEqual([])
  })

  it('waits for a person in a step without auto start, then launches on demand', async () => {
    columns.create(projectId, MANUAL_STEP)
    const card = cardOf(storyId)

    const moved = await mover.move(card.id, 'security_audit')
    expect(moved.started).toBe(false)
    expect(launched).toEqual([])

    const launchedNow = await mover.launch(card.id)
    expect(launchedNow.started).toBe(true)
    expect(launched).toHaveLength(1)
  })

  it('lets a story sit in a custom step whose key is no story state', async () => {
    const step = columns.create(projectId, MANUAL_STEP)

    await mover.move(cardOf(storyId).id, 'security_audit')

    expect(db.prepare('SELECT workflow_column_id FROM story WHERE id = ?').get(storyId)).toEqual({
      workflow_column_id: step.id,
    })
    expect(() => columns.remove(projectId, step.id)).toThrow()
  })

  it('brings the card back to its place when the step refuses to start', async () => {
    columns.create(projectId, { ...AGENT_STEP, label: 'Architecture' })
    const card = cardOf(storyId)

    await expect(mover.move(card.id, 'architecture')).rejects.toThrow(StoryTooThinError)

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'backlog' })
    expect(launched).toEqual([])
  })

  it('moves a card back to the backlog', async () => {
    columns.create(projectId, MANUAL_STEP)
    const card = cardOf(storyId)
    await mover.move(card.id, 'security_audit')

    const moved = await mover.move(card.id, 'backlog')

    expect(moved.card.stepKey).toBe('backlog')
  })

  it('refuses a step the project does not have', async () => {
    await expect(mover.move(cardOf(storyId).id, 'nowhere')).rejects.toThrow(UnknownStepKeyError)
  })

  it('refuses to drop a card in done, which is earned, and to take one out of it', async () => {
    columns.create(projectId, MANUAL_STEP)
    const card = cardOf(storyId)
    await expect(mover.move(card.id, 'done')).rejects.toThrow(DoneIsEarnedError)

    stories.markDoneAndUnblock(storyId)
    await expect(mover.move(card.id, 'security_audit')).rejects.toThrow(DoneIsFinalError)
  })

  it('refuses to move a card whose session is running', async () => {
    columns.create(projectId, AGENT_STEP)
    columns.create(projectId, MANUAL_STEP)
    const card = cardOf(storyId)
    await mover.move(card.id, 'spec')

    await expect(mover.move(card.id, 'security_audit')).rejects.toThrow(StepBusyError)
  })

  it('refuses to launch from the backlog', async () => {
    await expect(mover.launch(cardOf(storyId).id)).rejects.toThrow(LaunchNeedsAStepError)
  })

  it('reads the session state and the cost on the card', async () => {
    columns.create(projectId, AGENT_STEP)
    const card = cardOf(storyId)
    await mover.move(card.id, 'spec')
    db.prepare("UPDATE agent_session SET lifecycle = 'finished', outcome = 'succeeded', cost_usd = 0.42").run()

    expect(cardOf(storyId)).toMatchObject({ status: 'to_validate', costUsd: 0.42 })

    db.prepare("UPDATE agent_session SET lifecycle = 'failed', outcome = 'failed'").run()
    expect(cardOf(storyId).status).toBe('failed')
  })
})

describe('GET /api/forge-cards', () => {
  it('lists the cards of the project', async () => {
    const answer = await ask(`/api/forge-cards?project=${projectId}`)

    expect(answer.status).toBe(200)
    expect(((await answer.json()) as ForgeCardView[]).map((card) => card.storyId)).toEqual([storyId])
  })

  it('answers 422 without a project and 404 for an unknown one', async () => {
    expect((await ask('/api/forge-cards')).status).toBe(422)
    expect((await ask('/api/forge-cards?project=999')).status).toBe(404)
  })
})

describe('POST /api/forge-cards/:id/move', () => {
  it('moves the card and announces the session it started', async () => {
    columns.create(projectId, AGENT_STEP)
    const card = cardOf(storyId)

    const answer = await ask(`/api/forge-cards/${card.id}/move`, 'POST', { stepKey: 'spec' })

    expect(answer.status).toBe(200)
    expect(((await answer.json()) as ForgeCardMoved).started).toBe(true)
    expect(published).toEqual(['session.dispatched'])
  })

  it('answers 422 to an invalid order and 409 to a refused one', async () => {
    const card = cardOf(storyId)
    expect((await ask(`/api/forge-cards/${card.id}/move`, 'POST', {})).status).toBe(422)
    expect((await ask(`/api/forge-cards/${card.id}/move`, 'POST', { stepKey: 'nowhere' })).status).toBe(409)
    expect((await ask('/api/forge-cards/999/move', 'POST', { stepKey: 'backlog' })).status).toBe(409)
  })
})

describe('POST /api/forge-cards/backlog', () => {
  it('adds a story to the backlog of a subject, with its card', async () => {
    const answer = await ask('/api/forge-cards/backlog', 'POST', { subjectId: epicId, title: 'Export the mails' })

    expect(answer.status).toBe(201)
    expect(await answer.json()).toMatchObject({ title: 'Export the mails', stepKey: 'backlog', subjectId: epicId })
    expect(board.list(projectId)).toHaveLength(2)
  })

  it('refuses an empty title and an unknown subject', async () => {
    expect((await ask('/api/forge-cards/backlog', 'POST', { subjectId: epicId, title: '  ' })).status).toBe(422)
    expect((await ask('/api/forge-cards/backlog', 'POST', { subjectId: 999, title: 'x' })).status).toBe(404)
  })
})

describe('POST /api/forge-cards/:id/launch', () => {
  it('starts the agent of the step the card is in', async () => {
    columns.create(projectId, MANUAL_STEP)
    const card = cardOf(storyId)
    await mover.move(card.id, 'security_audit')

    const answer = await ask(`/api/forge-cards/${card.id}/launch`, 'POST', {})

    expect(answer.status).toBe(201)
    expect(launched).toHaveLength(1)
  })
})

describe('the pipeline actions', () => {
  it('launches, retries after a failure and validates into the next step', async () => {
    columns.create(projectId, AGENT_STEP)
    columns.create(projectId, MANUAL_STEP)
    const card = cardOf(storyId)

    const first = await ask(`/api/forge-cards/${card.id}/move`, 'POST', { stepKey: 'spec' })
    expect(first.status).toBe(200)
    expect(launched).toHaveLength(1)

    db.prepare("UPDATE agent_session SET lifecycle = 'failed', outcome = 'failed'").run()
    expect(cardOf(storyId).status).toBe('failed')

    const retried = await ask(`/api/forge-cards/${card.id}/launch`, 'POST', {})
    expect(retried.status).toBe(201)
    expect(launched).toHaveLength(2)

    db.prepare("UPDATE agent_session SET lifecycle = 'finished', outcome = 'succeeded'").run()
    expect(cardOf(storyId).status).toBe('to_validate')

    const validated = await ask(`/api/forge-cards/${card.id}/move`, 'POST', { stepKey: 'security_audit' })
    expect(validated.status).toBe(200)
    expect(cardOf(storyId).stepKey).toBe('security_audit')
    expect(launched).toHaveLength(2)
  })

  it('refuses a retry while the session still runs', async () => {
    columns.create(projectId, AGENT_STEP)
    const card = cardOf(storyId)
    await mover.move(card.id, 'spec')

    const retried = await ask(`/api/forge-cards/${card.id}/launch`, 'POST', {})

    expect(retried.status).toBe(409)
    expect(launched).toHaveLength(1)
  })
})
