import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createDiscussionRepository } from '../../../src/domain/Discussion/DiscussionRepository.js'
import { createDiscussionApi } from '../../../src/domain/Discussion/DiscussionApi.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'

let db: Database.Database
let api: Hono
let storyId: number
let published: string[]

function post(path: string, body: unknown): Promise<Response> {
  return api.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const events = createEventBus()
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
  api = createDiscussionApi({
    stories,
    discussion: createDiscussionRepository(db, { stories }),
    events,
  })
})

describe('GET /api/stories/:id/discussion', () => {
  it('serves an empty thread and no hold on a fresh story', async () => {
    const response = await api.request(`/api/stories/${storyId}/discussion`)

    expect(await response.json()).toEqual({ remarks: [], hold: null })
  })

  it('serves the remarks written so far', async () => {
    await post(`/api/stories/${storyId}/discussion`, { body: 'il manque le cas vide' })

    const response = await api.request(`/api/stories/${storyId}/discussion`)
    const served = (await response.json()) as { remarks: { body: string }[] }

    expect(served.remarks.map((remark) => remark.body)).toEqual(['il manque le cas vide'])
  })

  it('serves the open hold with its reason', async () => {
    await post(`/api/stories/${storyId}/hold`, { reason: 'il me faut un arbitrage' })

    const response = await api.request(`/api/stories/${storyId}/discussion`)
    const served = (await response.json()) as { hold: { reason: string } | null }

    expect(served.hold?.reason).toBe('il me faut un arbitrage')
  })

  it('refuses an unreadable identifier', async () => {
    const response = await api.request('/api/stories/rien/discussion')

    expect(response.status).toBe(422)
  })

  it('answers 404 on an unknown story', async () => {
    const response = await api.request('/api/stories/9999/discussion')

    expect(response.status).toBe(404)
  })
})

describe('POST /api/stories/:id/discussion', () => {
  it('keeps the remark and answers with it', async () => {
    const response = await post(`/api/stories/${storyId}/discussion`, { body: 'fais le simple' })

    expect([response.status, ((await response.json()) as { body: string }).body]).toEqual([
      201,
      'fais le simple',
    ])
  })

  it('signs the remark with the operator and its human voice', async () => {
    const response = await post(`/api/stories/${storyId}/discussion`, { body: 'fais le simple' })
    const remark = (await response.json()) as { author: string; voice: string }

    expect([remark.author, remark.voice]).toEqual(['local', 'human'])
  })

  it('announces the remark on the bus', async () => {
    await post(`/api/stories/${storyId}/discussion`, { body: 'fais le simple' })

    expect(published).toContain('story.remarked')
  })

  it('refuses a blank remark', async () => {
    const response = await post(`/api/stories/${storyId}/discussion`, { body: '  ' })

    expect(response.status).toBe(422)
  })

  it('lifts the hold that was waiting for a human', async () => {
    await post(`/api/stories/${storyId}/hold`, { reason: 'il me faut un arbitrage' })

    await post(`/api/stories/${storyId}/discussion`, { body: 'fais le simple' })
    const response = await api.request(`/api/stories/${storyId}/discussion`)

    expect(((await response.json()) as { hold: unknown }).hold).toBe(null)
  })

  it('announces that the story was freed', async () => {
    await post(`/api/stories/${storyId}/hold`, { reason: 'il me faut un arbitrage' })
    published = []

    await post(`/api/stories/${storyId}/discussion`, { body: 'fais le simple' })

    expect(published).toContain('story.freed')
  })

  it('says nothing about freeing a story that was not held', async () => {
    await post(`/api/stories/${storyId}/discussion`, { body: 'fais le simple' })

    expect(published).not.toContain('story.freed')
  })
})

describe('POST /api/stories/:id/hold', () => {
  it('raises the hold and answers with it', async () => {
    const response = await post(`/api/stories/${storyId}/hold`, { reason: 'deux projets touches' })

    expect([response.status, ((await response.json()) as { reason: string }).reason]).toEqual([
      201,
      'deux projets touches',
    ])
  })

  it('announces the hold on the bus', async () => {
    await post(`/api/stories/${storyId}/hold`, { reason: 'deux projets touches' })

    expect(published).toContain('story.held')
  })

  it('refuses a hold without a reason', async () => {
    const response = await post(`/api/stories/${storyId}/hold`, { reason: '  ' })

    expect(response.status).toBe(422)
  })

  it('refuses to hold a story twice', async () => {
    await post(`/api/stories/${storyId}/hold`, { reason: 'premier' })

    const response = await post(`/api/stories/${storyId}/hold`, { reason: 'second' })

    expect(response.status).toBe(409)
  })

  it('answers 404 on an unknown story', async () => {
    const response = await post('/api/stories/9999/hold', { reason: 'ohe' })

    expect(response.status).toBe(404)
  })
})

describe('GET /api/board/holds', () => {
  it('serves nothing while no story is held', async () => {
    const response = await api.request('/api/board/holds')

    expect(await response.json()).toEqual([])
  })

  it('serves the story identifier and the reason of every hold', async () => {
    await post(`/api/stories/${storyId}/hold`, { reason: 'deux projets touches' })

    const response = await api.request('/api/board/holds')
    const held = (await response.json()) as { storyId: number; reason: string }[]

    expect(held.map((one) => [one.storyId, one.reason])).toEqual([[storyId, 'deux projets touches']])
  })

  it('forgets a hold that a human answered', async () => {
    await post(`/api/stories/${storyId}/hold`, { reason: 'deux projets touches' })
    await post(`/api/stories/${storyId}/discussion`, { body: 'tranche ainsi' })

    const response = await api.request('/api/board/holds')

    expect(await response.json()).toEqual([])
  })
})
