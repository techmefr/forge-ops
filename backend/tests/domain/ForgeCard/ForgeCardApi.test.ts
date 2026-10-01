import { beforeEach, describe, expect, it } from 'vitest'
import type { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createForgeCardRepository, type ForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import { createForgeCardApi } from '../../../src/domain/ForgeCard/ForgeCardApi.js'
import { createWorktreeRepository } from '../../../src/domain/Worktree/WorktreeRepository.js'

function fakeGit() {
  return {
    headSha: (baseRef: string) => `sha-of-${baseRef}`,
    addWorktree: () => undefined,
    removeWorktree: () => undefined,
    deleteBranch: () => undefined,
    isDirty: () => false,
  }
}

let db: Database.Database
let stories: StoryRepository
let api: Hono
let forgeCards: ForgeCardRepository
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
  forgeCards = createForgeCardRepository(db)
  api = createForgeCardApi({
    forgeCards,
    worktrees: createWorktreeRepository(db, { stories, git: fakeGit(), root: '/tmp/forge-worktrees' }),
  })
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

describe('POST /api/forge-cards/:id/worktree', () => {
  it('ouvre le worktree de la story portee par la forge', async () => {
    const card = forgeCards.createForgeCard({ storyIds: [storyId] })

    const response = await ask(`/api/forge-cards/${card.id}/worktree`, 'POST', { baseRef: 'main' })
    expect(response.status).toBe(201)
    const worktree = (await response.json()) as { storyId: number; forgeCardId: number }
    expect(worktree.storyId).toBe(storyId)
    expect(worktree.forgeCardId).toBe(card.id)
  })

  it('refuse une forge introuvable avec un statut 409', async () => {
    const response = await ask('/api/forge-cards/999/worktree', 'POST', { baseRef: 'main' })
    expect(response.status).toBe(409)
  })

  it('refuse un identifiant invalide avec un statut 422', async () => {
    const response = await ask('/api/forge-cards/pas-un-id/worktree', 'POST', { baseRef: 'main' })
    expect(response.status).toBe(422)
  })
})
