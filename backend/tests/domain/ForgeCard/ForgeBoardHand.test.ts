import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createWorkflowColumnRepository } from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import { createForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import { createForgeBoardRepository } from '../../../src/domain/ForgeCard/ForgeBoardRepository.js'
import { createForgeCardMover } from '../../../src/domain/ForgeCard/ForgeCardMover.js'
import { createForgeBoardApi } from '../../../src/domain/ForgeCard/ForgeBoardApi.js'
import type { StepEntry } from '../../../src/domain/Dispatch/Dispatch.js'

let app: Hono
let entered: StepEntry[]
let epicId: number
let cardId: number

async function ask(login: string, path: string, body: unknown): Promise<Response> {
  return (await app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-login': login },
    body: JSON.stringify(body),
  })) as Response
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const columns = createWorkflowColumnRepository(db)
  entered = []
  const projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  epicId = stories.createEpic({ projectId, title: 'CRUD Mail', businessIntent: 'manage' }).id
  stories.assignEpic(epicId, 'ana')
  columns.create(projectId, {
    label: 'Audit',
    colour: 'acc',
    provider: 'claude',
    model: 'claude-sonnet-5',
    effort: 'high',
    agentName: '',
    command: '',
    preprompt: '',
    autoStart: true,
  })
  const story = stories.writeStory({ epicId, title: 'see the mails', body: 'body' })
  stories.writeTwin({ storyId: story.id, title: 'tests', body: 'cases' })
  stories.sendToBacklog(story.id)
  const forgeCards = createForgeCardRepository(db)
  const board = createForgeBoardRepository(db, { forgeCards, columns })
  cardId = board.list(projectId)[0]?.id ?? 0
  const enterStep = async (entry: StepEntry) => {
    entered.push(entry)
    return null
  }
  const mover = createForgeCardMover({
    board,
    forgeCards,
    stories,
    columns,
    enterStep,
    launchStep: async () => ({ claudeSessionId: 'session' }),
  })
  app = new Hono()
  app.use('*', async (context, next) => {
    context.set('login', context.req.header('x-login') ?? 'local')
    await next()
  })
  app.route('/', createForgeBoardApi({ board, mover, forgeCards, stories, events: { publish: () => undefined } }))
})

describe('who may move the cards of a subject', () => {
  it('refuses a move, a launch and a backlog story from someone who does not hold the subject', async () => {
    expect((await ask('bob', `/api/forge-cards/${cardId}/move`, { stepKey: 'audit' })).status).toBe(409)
    expect((await ask('bob', `/api/forge-cards/${cardId}/launch`, {})).status).toBe(409)
    expect((await ask('bob', '/api/forge-cards/backlog', { subjectId: epicId, title: 'Sneaky' })).status).toBe(409)
    expect(entered).toHaveLength(0)
  })

  it('lets the holder move the card', async () => {
    expect((await ask('ana', `/api/forge-cards/${cardId}/move`, { stepKey: 'audit' })).status).toBe(200)
    expect(entered).toHaveLength(1)
  })
})
