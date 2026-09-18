import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createConversationApi } from '../../../src/domain/Conversation/ConversationApi.js'
import { framedTurn, type SpokenTurn } from '../../../src/domain/Conversation/Conversation.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'
import { createDiscussionRepository } from '../../../src/domain/Discussion/DiscussionRepository.js'
import { createTemplateRepository } from '../../../src/domain/Template/TemplateRepository.js'

let db: Database.Database
let api: Hono
let storyId: number
let epicId: number
let stories: ReturnType<typeof createStoryRepository>
let said: SpokenTurn[]
let hungUp: string[]
let living: boolean
let published: string[]

function talk(id: number, body: unknown): Promise<Response> {
  return api.request(`/api/stories/${id}/talk`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

let sessions: ReturnType<typeof createAgentSessionRepository>
let discussion: ReturnType<typeof createDiscussionRepository>
let checkpoints: ReturnType<typeof createCheckpointRepository>
let templates: ReturnType<typeof createTemplateRepository>

beforeAll(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  sessions = createAgentSessionRepository(db)
  discussion = createDiscussionRepository(db, { stories })
  checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
  })
  templates = createTemplateRepository(db)
})

afterEach(() => {
  db.exec(
    'DELETE FROM agent_session; DELETE FROM story_remark; DELETE FROM acceptance_criterion;' +
      ' DELETE FROM checkpoint; DELETE FROM story; DELETE FROM epic; DELETE FROM project;' +
      ' DELETE FROM sqlite_sequence',
  )
})

beforeEach(() => {
  const events = createEventBus()
  said = []
  hungUp = []
  living = true
  published = []
  events.subscribe((event) => {
    published.push(event.name)
  })
  const project = stories.createProject({
    slug: 'forge',
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
  epicId = epic.id
  storyId = stories.writeStory({ epicId: epic.id, title: 'un titre', body: 'un corps' }).id
  api = createConversationApi({
    stories,
    sessions,
    events,
    discussion,
    checkpoints,
    templates,
    talker: {
      say: (turn) => {
        said.push(turn)
        return Promise.resolve()
      },
      hangUp: (claudeSessionId) => {
        hungUp.push(claudeSessionId)
      },
      isLive: () => living,
    },
  })
})

function openSession(): string {
  return sessions.registerSession({
    storyId,
    claudeSessionId: 'session-abc',
    phase: 'spec',
    agentName: 'architecte',
    claudeCodeVersion: '2.1.224',
  }).claudeSessionId
}

describe('POST /api/stories/:id/talk', () => {
  it('carries the turn to the running session', async () => {
    openSession()
    const response = await talk(storyId, { message: 'parle du filtre par projet' })

    expect(response.status).toBe(202)
    expect(said[0]?.claudeSessionId).toBe('session-abc')
  })

  it('frames the turn so the agent knows to rewrite the card', async () => {
    openSession()
    await talk(storyId, { message: 'parle du filtre' })

    expect(said[0]?.message).toBe(framedTurn('parle du filtre', 'FORGE-1'))
  })

  it('shows the human line in the transcript', async () => {
    openSession()
    await talk(storyId, { message: 'parle du filtre' })

    expect(published).toContain('session.human')
  })

  it('talks to the newest session when several ran', async () => {
    openSession()
    sessions.registerSession({
      storyId,
      claudeSessionId: 'session-def',
      phase: 'architecture',
      agentName: 'architecte',
      claudeCodeVersion: '2.1.224',
    })
    await talk(storyId, { message: 'et le plan' })

    expect(said[0]?.claudeSessionId).toBe('session-def')
  })

  it('refuses when no session ever ran on the story', async () => {
    const response = await talk(storyId, { message: 'parle' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'NoSessionToTalkTo' })
  })

  it('says nothing to anyone when it refuses', async () => {
    await talk(storyId, { message: 'parle' })

    expect(said).toEqual([])
  })

  it('refuses an empty turn', async () => {
    openSession()
    expect((await talk(storyId, { message: '   ' })).status).toBe(422)
  })

  it('refuses a body without a message', async () => {
    openSession()
    expect((await talk(storyId, {})).status).toBe(422)
  })

  it('refuses an identifier that is not one', async () => {
    const response = await api.request('/api/stories/nope/talk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'parle' }),
    })

    expect(response.status).toBe(422)
  })

  it('refuses an unknown story', async () => {
    expect((await talk(storyId + 500, { message: 'parle' })).status).toBe(404)
  })
})

describe('DELETE /api/stories/:id/talk', () => {
  function hangUp(id: number): Promise<Response> {
    return api.request(`/api/stories/${id}/talk`, { method: 'DELETE' }) as Promise<Response>
  }

  it('closes the session so its slot comes back', async () => {
    openSession()

    const response = await hangUp(storyId)

    expect([response.status, hungUp]).toEqual([200, ['session-abc']])
  })

  it('records the session as cut short by the human', async () => {
    openSession()

    await hangUp(storyId)

    expect(sessions.findByClaudeSessionId('session-abc')?.lifecycle).toBe(
      'interrupted',
    )
  })

  it('dates the end so the session stops counting as running', async () => {
    openSession()

    await hangUp(storyId)

    const ended = db
      .prepare<[string], { ended_at: string | null }>(
        'SELECT ended_at FROM agent_session WHERE claude_session_id = ?',
      )
      .get('session-abc')

    expect(ended?.ended_at).not.toBeNull()
  })

  it('announces the end on the bus', async () => {
    openSession()

    await hangUp(storyId)

    expect(published).toContain('session.hung_up')
  })

  it('stays quiet when no session ever ran', async () => {
    const response = await hangUp(storyId)

    expect([response.status, hungUp]).toEqual([200, []])
  })

  it('answers 404 on an unknown story', async () => {
    expect((await hangUp(9999)).status).toBe(404)
  })

  it('refuses an unreadable identifier', async () => {
    const response = await api.request('/api/stories/rien/talk', { method: 'DELETE' })

    expect(response.status).toBe(422)
  })

  it('lets a second hang-up pass without breaking', async () => {
    openSession()
    await hangUp(storyId)

    expect((await hangUp(storyId)).status).toBe(200)
  })
})

describe('talking to a conversation that is over', () => {
  it('refuses the turn instead of pretending to resume', async () => {
    openSession()
    living = false

    const response = await talk(storyId, { message: 'tu es la ?' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'ConversationClosed' })
  })

  it('says nothing to the agent', async () => {
    openSession()
    living = false

    await talk(storyId, { message: 'tu es la ?' })

    expect(said).toEqual([])
  })

  it('keeps the human line out of the transcript', async () => {
    openSession()
    living = false

    await talk(storyId, { message: 'tu es la ?' })

    expect(published).not.toContain('session.human')
  })

  it('names the story so the screen can offer a new session', async () => {
    openSession()
    living = false

    const response = await talk(storyId, { message: 'tu es la ?' })

    await expect(response.json()).resolves.toMatchObject({ reference: 'FORGE-1' })
  })
})

describe('whose hand may talk', () => {
  function signedAs(login: string): void {
    const signed = new Hono()
    signed.use('*', async (context, next) => {
      context.set('login', login)
      await next()
    })
    signed.route('/', api)
    api = signed
  }

  it('refuses a turn from an operator the epic does not belong to', async () => {
    openSession()
    stories.claimEpic(epicId, 'frodo')
    signedAs('gollum')

    const response = await talk(storyId, { message: 'parle du filtre' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'StoryNotYoursError' })
    expect(said).toEqual([])
  })

  it('lets the operator the epic belongs to talk', async () => {
    openSession()
    stories.claimEpic(epicId, 'frodo')
    signedAs('frodo')

    const response = await talk(storyId, { message: 'parle du filtre' })

    expect(response.status).toBe(202)
    expect(said).toHaveLength(1)
  })

  it('leaves an unclaimed epic open to whoever holds the board', async () => {
    openSession()

    const response = await talk(storyId, { message: 'parle du filtre' })

    expect(response.status).toBe(202)
  })

  it('refuses a hang up from an operator the epic does not belong to', async () => {
    openSession()
    stories.claimEpic(epicId, 'frodo')
    signedAs('gollum')

    const response = (await api.request(`/api/stories/${storyId}/talk`, {
      method: 'DELETE',
    })) as Response

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'StoryNotYoursError' })
    expect(hungUp).toEqual([])
  })
})
