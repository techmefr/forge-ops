import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createForgeCardRepository, type ForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import { createForgeCardApi } from '../../../src/domain/ForgeCard/ForgeCardApi.js'
import { createWorktreeApi } from '../../../src/domain/Worktree/WorktreeApi.js'
import { createWorktreeRepository } from '../../../src/domain/Worktree/WorktreeRepository.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'

let db: Database.Database
let stories: StoryRepository
let forgeCards: ForgeCardRepository
let app: Hono
let storyId: number
let cardId: number
let gitFails: boolean

function fakeGit() {
  return {
    headSha: (baseRef: string) => `sha-of-${baseRef}`,
    addWorktree: () => {
      if (gitFails) {
        throw new Error('git refused')
      }
    },
    removeWorktree: () => undefined,
    deleteBranch: () => undefined,
    isDirty: () => false,
  }
}

function ask(login: string, path: string, method: string, body?: unknown): Promise<Response> {
  return app.request(path, {
    method,
    headers: { 'content-type': 'application/json', 'x-login': login },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }) as Promise<Response>
}

beforeEach(() => {
  gitFails = false
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  forgeCards = createForgeCardRepository(db)
  const worktrees = createWorktreeRepository(db, { stories, git: fakeGit(), root: '/tmp/forge-worktrees' })
  app = new Hono()
  app.use('*', async (context, next) => {
    context.set('login', context.req.header('x-login') ?? 'local')
    await next()
  })
  app.route('/', createWorktreeApi({ worktrees, stories, events: createEventBus() }))
  app.route('/', createForgeCardApi({ forgeCards, worktrees, stories }))
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'main',
    colour: '#8B5CFF',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'demo', businessIntent: 'besoin' })
  stories.assignEpic(epic.id, 'ana')
  const story = stories.writeStory({ epicId: epic.id, title: 'premiere', body: 'corps' })
  stories.writeTwin({ storyId: story.id, title: 'jumelle', body: 'corps' })
  stories.sendToBacklog(story.id)
  storyId = story.id
  cardId = forgeCards.createForgeCard({ storyIds: [story.id] }).id
})

describe('a base ref that looks like a git option', () => {
  it.each(['--show-toplevel', '-b', '--output=/tmp/x', 'main..other', 'a b', 'branch.lock'])(
    'is refused on the story worktree route: %s',
    async (baseRef) => {
      const response = await ask('ana', `/api/stories/${storyId}/worktree`, 'POST', { baseRef })

      expect(response.status).toBe(422)
    },
  )

  it.each(['--show-toplevel', '-b'])('is refused on the forge card worktree route: %s', async (baseRef) => {
    const response = await ask('ana', `/api/forge-cards/${cardId}/worktree`, 'POST', { baseRef })

    expect(response.status).toBe(422)
  })

  it.each(['HEAD', 'main', 'origin/main', 'release/1.2', 'HEAD~1', 'v1.0.0'])(
    'lets an ordinary ref through: %s',
    async (baseRef) => {
      const response = await ask('ana', `/api/stories/${storyId}/worktree`, 'POST', { baseRef })

      expect(response.status).toBe(201)
    },
  )
})

describe('a git that fails while opening', () => {
  it('leaves the story free to open again', async () => {
    gitFails = true
    const failed = await ask('ana', `/api/stories/${storyId}/worktree`, 'POST', { baseRef: 'main' })
    expect(failed.status).toBe(500)

    gitFails = false
    const retried = await ask('ana', `/api/stories/${storyId}/worktree`, 'POST', { baseRef: 'main' })

    expect(retried.status).toBe(201)
  })
})

describe('a member who does not hold the story', () => {
  it('cannot open its worktree', async () => {
    const response = await ask('bob', `/api/stories/${storyId}/worktree`, 'POST', { baseRef: 'main' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'StoryNotYoursError' })
  })

  it('cannot open the worktree of its forge card', async () => {
    const response = await ask('bob', `/api/forge-cards/${cardId}/worktree`, 'POST', { baseRef: 'main' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: 'StoryNotYoursError' })
  })

  it('cannot close it', async () => {
    await ask('ana', `/api/stories/${storyId}/worktree`, 'POST', { baseRef: 'main' })

    const response = await ask('bob', `/api/stories/${storyId}/worktree`, 'DELETE')

    expect(response.status).toBe(409)
    const still = await ask('ana', `/api/stories/${storyId}/worktree`, 'GET')
    await expect(still.json()).resolves.not.toBeNull()
  })

  it('leaves the holder free to open and close it', async () => {
    const opened = await ask('ana', `/api/stories/${storyId}/worktree`, 'POST', { baseRef: 'main' })
    const closed = await ask('ana', `/api/stories/${storyId}/worktree`, 'DELETE')

    expect([opened.status, closed.status]).toEqual([201, 200])
  })
})
