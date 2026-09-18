import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'
import { createDiscussionRepository } from '../../../src/domain/Discussion/DiscussionRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createTemplateRepository } from '../../../src/domain/Template/TemplateRepository.js'
import {
  AGENT_SESSION_HEADER,
  createConversationApi,
} from '../../../src/domain/Conversation/ConversationApi.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import type { StoryThread } from '../../../src/domain/Conversation/Thread.js'

let db: Database.Database
let api: Hono
let stories: ReturnType<typeof createStoryRepository>
let sessions: ReturnType<typeof createAgentSessionRepository>
let checkpoints: ReturnType<typeof createCheckpointRepository>
let discussion: ReturnType<typeof createDiscussionRepository>
let templates: ReturnType<typeof createTemplateRepository>
let criteria: ReturnType<typeof createCriterionRepository>
let storyId: number
let published: string[]

function thread(id: number): Promise<Response> {
  return api.request(`/api/stories/${id}/thread`) as Promise<Response>
}

function validate(id: number, headers: Record<string, string> = {}): Promise<Response> {
  return api.request(`/api/stories/${id}/validate`, { method: 'POST', headers }) as Promise<Response>
}

beforeAll(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  sessions = createAgentSessionRepository(db)
  checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
  })
  discussion = createDiscussionRepository(db, { stories })
  templates = createTemplateRepository(db)
  criteria = createCriterionRepository(db)
})

beforeEach(() => {
  const events = createEventBus()
  published = []
  events.subscribe((event) => {
    published.push(event.name)
  })
  api = createConversationApi({
    stories,
    sessions,
    events,
    discussion,
    checkpoints,
    templates,
    talker: {
      say: () => Promise.resolve(),
      hangUp: () => undefined,
      isLive: () => true,
    },
  })
  const project = stories.createProject({
    slug: `forge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'Gerer les mails',
  })
  storyId = stories.writeStory({
    epicId: epic.id,
    title: 'the card is the conversation',
    body: 'one thread',
  }).id
  stories.writeTwin({ storyId, title: 'twin', body: 'twin body' })
})

afterEach(() => {
  db.exec('DELETE FROM checkpoint; DELETE FROM acceptance_criterion; DELETE FROM story_remark; DELETE FROM agent_session')
})

describe('reading the thread of a card', () => {
  it('opens with the prompt the first column of the template declares', async () => {
    const response = await thread(storyId)
    expect(response.status).toBe(200)
    const body = (await response.json()) as StoryThread
    expect(body.opening?.prompt.length ?? 0).toBeGreaterThan(0)
    expect(body.awaitsValidation).toBe(true)
  })

  it('answers 404 for a story nobody wrote', async () => {
    expect((await thread(9999)).status).toBe(404)
  })

  it('reads the thread after the sessions are gone', async () => {
    sessions.registerSession({
      storyId,
      claudeSessionId: 'cs-spec',
      phase: 'spec',
      agentName: 'architect',
      claudeCodeVersion: '1.0.0',
    })
    discussion.writeRemark({ storyId, author: 'architect', voice: 'agent', body: 'voici la spec' })
    const criterion = criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'la carte porte le fil' })
    criteria.satisfyCriterion(criterion.id, '.claude/evidence/criterion.md')
    checkpoints.proveCheckpoint({
      storyId,
      name: 'spec_done',
      evidencePath: '.claude/evidence/spec_done.md',
    })
    sessions.closeSession('cs-spec', { exitCode: 0 })
    const body = (await (await thread(storyId)).json()) as StoryThread
    const entries = body.chapters.at(-1)?.entries ?? []
    expect(entries.map((entry) => entry.kind)).toEqual(['testimony', 'proof'])
  })

  it('picks the same thread up rather than starting a new one', async () => {
    discussion.writeRemark({ storyId, author: 'gaetan', voice: 'human', body: 'et les jalons' })
    const first = (await (await thread(storyId)).json()) as StoryThread
    const second = (await (await thread(storyId)).json()) as StoryThread
    expect(second.chapters).toEqual(first.chapters)
  })
})

describe('the validation that sends the card to the backlog', () => {
  it('moves the story when a human says yes', async () => {
    const response = await validate(storyId)
    expect(response.status).toBe(200)
    expect(stories.findStory(storyId).state).toBe('backlog')
    expect(published).toContain('story.validated')
  })

  it('refuses the conversation ticking its own proof', async () => {
    const response = await validate(storyId, { [AGENT_SESSION_HEADER]: 'cs-spec' })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'AgentCannotValidate' })
    expect(stories.findStory(storyId).state).toBe('drafting')
  })

  it('refuses a second validation', async () => {
    await validate(storyId)
    const again = await validate(storyId)
    expect(again.status).toBe(409)
    expect(await again.json()).toMatchObject({ error: 'StoryAlreadyValidated' })
  })

  it('answers 404 for a story nobody wrote', async () => {
    expect((await validate(9999)).status).toBe(404)
  })
})
