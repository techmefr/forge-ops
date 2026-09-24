import { beforeEach, describe, expect, it } from 'vitest'
import type { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import { createForgeCardApi } from '../../../src/domain/ForgeCard/ForgeCardApi.js'

let db: Database.Database
let stories: StoryRepository
let api: Hono
let storyId: number

function ask(path: string, method = 'GET', body?: unknown): Promise<Response> {
  const asked =
    body === undefined
      ? api.request(path, { method })
      : api.request(path, {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
  return asked as Promise<Response>
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  api = createForgeCardApi({ forgeCards: createForgeCardRepository(db) })
  const project = stories.createProject({
    slug: 'forge',
    name: 'forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'main',
    colour: '#8B5CFF',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'demo', businessIntent: 'besoin' })
  const story = stories.writeStory({ epicId: epic.id, title: 'premiere', body: 'corps' })
  stories.writeTwin({ storyId: story.id, title: 'jumelle', body: 'corps' })
  stories.sendToBacklog(story.id)
  storyId = story.id
})

describe('POST /api/forge-cards', () => {
  it('cree une forge a partir des stories selectionnees', async () => {
    const response = await ask('/api/forge-cards', 'POST', { storyIds: [storyId] })
    expect(response.status).toBe(201)
    const card = (await response.json()) as { reference: string; storyIds: number[] }
    expect(card.reference).toBe('FORGE-1')
    expect(card.storyIds).toEqual([storyId])
  })

  it('refuse une selection vide avec un statut 409', async () => {
    const response = await ask('/api/forge-cards', 'POST', { storyIds: [] })
    expect(response.status).toBe(409)
  })

  it('refuse un corps invalide avec un statut 422', async () => {
    const response = await ask('/api/forge-cards', 'POST', { storyIds: 'pas-un-tableau' })
    expect(response.status).toBe(422)
  })
})
