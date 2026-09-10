import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createConversationApi } from '../../../src/domain/Conversation/ConversationApi.js'
import { framedTurn, type SpokenTurn } from '../../../src/domain/Conversation/Conversation.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'

let db: Database.Database
let api: Hono
let storyId: number
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

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const sessions = createAgentSessionRepository(db)
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
  storyId = stories.writeStory({ epicId: epic.id, title: 'un titre', body: 'un corps' }).id
  api = createConversationApi({
    stories,
    sessions,
    events,
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
  const sessions = createAgentSessionRepository(db)
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
    createAgentSessionRepository(db).registerSession({
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

  it('marks the session finished', async () => {
    openSession()

    await hangUp(storyId)

    expect(createAgentSessionRepository(db).findByClaudeSessionId('session-abc')?.lifecycle).toBe(
      'finished',
    )
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
