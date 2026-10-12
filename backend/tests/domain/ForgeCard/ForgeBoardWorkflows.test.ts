import { beforeEach, describe, expect, it } from 'vitest'
import type { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createWorkflowColumnRepository } from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import {
  createProjectWorkflowRepository,
  type ProjectWorkflowRepository,
} from '../../../src/domain/Workflow/ProjectWorkflowRepository.js'
import { createForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import {
  createForgeBoardRepository,
  type ForgeBoardRepository,
} from '../../../src/domain/ForgeCard/ForgeBoardRepository.js'
import { createForgeCardMover, type ForgeCardMover } from '../../../src/domain/ForgeCard/ForgeCardMover.js'
import { createForgeBoardApi } from '../../../src/domain/ForgeCard/ForgeBoardApi.js'
import { UnknownStepKeyError } from '../../../src/domain/ForgeCard/ForgeCardViolation.js'
import type { WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'
import type { ForgeCardView } from '../../../../contract/ForgeCardContract.js'

const STEP: WorkflowColumnDraft = {
  label: 'Spec',
  colour: 'acc',
  provider: 'claude',
  model: 'claude-sonnet-5',
  effort: 'high',
  agentName: '',
  command: '',
  preprompt: '',
  autoStart: false,
}

let db: Database.Database
let stories: StoryRepository
let workflows: ProjectWorkflowRepository
let board: ForgeBoardRepository
let mover: ForgeCardMover
let api: Hono
let projectId: number
let epicId: number
let featureId: number
let fixId: number

function cardOf(cardId: number): ForgeCardView {
  return board.view(cardId)
}

async function createBacklogCard(title: string, workflowId?: number): Promise<ForgeCardView> {
  const response = (await api.request('/api/forge-cards/backlog', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subjectId: epicId, title, ...(workflowId === undefined ? {} : { workflowId }) }),
  })) as Response
  expect(response.status).toBe(201)
  return (await response.json()) as ForgeCardView
}

beforeEach(() => {
  db = openDatabase(':memory:')
  const forgeCards = createForgeCardRepository(db)
  stories = createStoryRepository(db, { onBacklog: (story) => forgeCards.attachCardToStory(story.id) })
  const columns = createWorkflowColumnRepository(db)
  workflows = createProjectWorkflowRepository(db)
  projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  epicId = stories.createEpic({ projectId, title: 'CRUD Mail', businessIntent: 'manage' }).id
  featureId = workflows.defaultOf(projectId).id
  fixId = workflows.create(projectId, 'Hotfix').id
  columns.create(projectId, { ...STEP, label: 'Spec' }, featureId)
  columns.create(projectId, { ...STEP, label: 'Build' }, featureId)
  columns.create(projectId, { ...STEP, label: 'Diagnose' }, fixId)
  columns.create(projectId, { ...STEP, label: 'Build' }, fixId)
  board = createForgeBoardRepository(db, { forgeCards, columns })
  mover = createForgeCardMover({
    board,
    forgeCards,
    stories,
    columns,
    enterStep: async () => null,
    launchStep: async () => null,
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
    events: { publish: () => undefined },
  })
})

describe('cards in several workflows of one project', () => {
  it('puts a card in the first workflow when none is named', async () => {
    const card = await createBacklogCard('see the mails of the customer')

    expect(card.workflowId).toBe(featureId)
  })

  it('puts a card in the workflow it is created for', async () => {
    const card = await createBacklogCard('repair the mail export', fixId)

    expect(card.workflowId).toBe(fixId)
    expect(board.list(projectId).map((listed) => listed.workflowId)).toEqual([fixId])
  })

  it('moves a card through the steps of its own workflow only', async () => {
    const card = await createBacklogCard('repair the mail export', fixId)

    await mover.move(card.id, 'diagnose')

    expect(cardOf(card.id).stepKey).toBe('diagnose')
    await expect(mover.move(card.id, 'spec')).rejects.toBeInstanceOf(UnknownStepKeyError)
  })

  it('places a card on the step of its workflow when two workflows share a step key', async () => {
    const feature = await createBacklogCard('see the mails of the customer', featureId)
    const fix = await createBacklogCard('repair the mail export', fixId)

    await mover.move(feature.id, 'build')
    await mover.move(fix.id, 'build')

    const placed = db
      .prepare<[], { reference: string; workflow_id: number }>(
        'SELECT story.reference AS reference, workflow_column.workflow_id AS workflow_id FROM story JOIN workflow_column ON workflow_column.id = story.workflow_column_id ORDER BY story.id',
      )
      .all()
    expect(placed.map((row) => row.workflow_id)).toEqual([featureId, fixId])
  })

  it('refuses a workflow of another project', async () => {
    const other = stories.createProject({
      slug: 'other',
      name: 'Other',
      repositoryUrl: 'git@github.com:techmefr/other.git',
      integrationBranch: 'main',
      colour: '#00aaff',
    }).id
    const foreign = workflows.defaultOf(other).id

    const response = (await api.request('/api/forge-cards/backlog', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subjectId: epicId, title: 'repair the mail export', workflowId: foreign }),
    })) as Response

    expect(response.status).toBe(409)
  })
})
