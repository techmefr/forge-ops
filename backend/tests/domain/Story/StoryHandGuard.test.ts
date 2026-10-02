import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createIdentityRepository } from '../../../src/domain/Identity/IdentityRepository.js'
import { createEpicApi } from '../../../src/domain/Epic/EpicApi.js'
import { createStoryHandGuard } from '../../../src/domain/Story/StoryHandGuard.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { buildTestBoard } from '../Board/TestBoard.js'

const PASSWORD = 'un mot de passe assez long'

let db: Database.Database
let app: Hono
let stories: StoryRepository
let epicId: number
let storyId: number
let alone: { epicId: number; storyId: number }

function call(method: string, path: string, login: string, body?: unknown): Promise<Response> {
  return app.request(path, {
    method,
    headers: { 'content-type': 'application/json', 'x-login': login },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

function seedStory(projectId: number, title: string): { epicId: number; storyId: number } {
  const epic = stories.createEpic({ projectId, title, businessIntent: 'besoin' })
  const story = stories.writeStory({ epicId: epic.id, title: 'une carte', body: 'corps' })
  return { epicId: epic.id, storyId: story.id }
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  const identities = createIdentityRepository(db)
  identities.enrolUser({ login: 'alice', displayName: 'Alice', password: PASSWORD, role: 'architect' })
  identities.enrolUser({ login: 'bob', displayName: 'Bob', password: PASSWORD, role: 'architect' })
  const padmin = identities.enrolUser({ login: 'padmin', displayName: 'Padmin', password: PASSWORD, role: 'architect' })
  identities.enrolUser({ login: 'dir', displayName: 'Dir', password: PASSWORD, role: 'director' })
  identities.bootstrapSuperAdmin({ login: 'root', password: PASSWORD })
  const project = stories.createProject({
    slug: 'alpha',
    name: 'Alpha',
    repositoryUrl: 'git@example.com:alpha.git',
    integrationBranch: 'main',
    colour: '#112233',
  })
  db.prepare('UPDATE project SET admin_user_id = ? WHERE id = ?').run(padmin.id, project.id)
  const held = seedStory(project.id, 'tenue')
  epicId = held.epicId
  storyId = held.storyId
  alone = seedStory(project.id, 'libre')
  stories.assignEpic(epicId, 'alice')

  const isSuperAdmin = (login: string): boolean => identities.findUser(login)?.superAdmin ?? false
  const isDirector = (login: string): boolean => identities.findUser(login)?.role === 'director'
  app = new Hono()
  app.use('*', async (context, next) => {
    context.set('login', context.req.header('x-login') ?? 'local')
    await next()
  })
  app.use('/api/*', createStoryHandGuard({ stories, isSuperAdmin, isDirector }))
  app.route('/', buildTestBoard(db).api)
  app.route(
    '/',
    createEpicApi({
      epics: stories.epics,
      events: createEventBus(),
      today: () => '2026-09-01',
      projects: stories.projects,
      isSuperAdmin,
      isDirector,
    }),
  )
})

const MUTATIONS: readonly (readonly [string, string, unknown])[] = [
  ['PUT', '/api/epics/EPIC/assignee', { login: 'bob' }],
  ['PATCH', '/api/epics/EPIC', { title: 'hijacked' }],
  ['DELETE', '/api/epics/EPIC', undefined],
  ['POST', '/api/stories/STORY/estimate', { points: 3 }],
  ['POST', '/api/stories/STORY/block', { reason: 'x' }],
  ['DELETE', '/api/stories/STORY/block', undefined],
  ['POST', '/api/stories/STORY/dispatch', { phase: 'spec' }],
  ['POST', '/api/stories/STORY/rollout', { rollout: 'direct' }],
]

function resolved(path: string): string {
  return path.replace('EPIC', String(epicId)).replace('STORY', String(storyId))
}

describe('who may act on an assigned epic and its stories', () => {
  it.each(MUTATIONS)('refuses a plain member on %s %s', async (method, path, body) => {
    const answer = await call(method, resolved(path), 'bob', body)
    expect(answer.status).toBe(409)
    expect(await answer.json()).toMatchObject({ error: 'StoryNotYoursError' })
  })

  it.each(MUTATIONS)('lets the holder through on %s %s', async (method, path, body) => {
    const answer = await call(method, resolved(path), 'alice', body)
    expect(answer.status).not.toBe(409)
    expect(answer.status).not.toBe(403)
  })

  it.each(['padmin', 'dir', 'root', 'local'])('lets %s through on every mutation', async (login) => {
    for (const [method, path, body] of MUTATIONS.filter(([, route]) => !route.includes('assignee'))) {
      const answer = await call(method, resolved(path), login, body)
      expect(answer.status, `${method} ${path}`).not.toBe(409)
    }
  })

  it('keeps the takeover from happening and leaves the epic untouched', async () => {
    expect((await call('PUT', `/api/epics/${epicId}/assignee`, 'bob', { login: 'bob' })).status).toBe(409)
    expect((await call('PATCH', `/api/epics/${epicId}`, 'bob', { title: 'hijacked' })).status).toBe(409)
    expect((await call('DELETE', `/api/epics/${epicId}`, 'bob')).status).toBe(409)
    expect(stories.assigneeOf(epicId)).toBe('alice')
    expect(db.prepare('SELECT title FROM epic WHERE id = ?').get(epicId)).toEqual({ title: 'tenue' })
    expect(db.prepare('SELECT deleted_at FROM epic WHERE id = ?').get(epicId)).toEqual({ deleted_at: null })
  })

  it('lets an admin reassign the epic to someone else', async () => {
    expect((await call('PUT', `/api/epics/${epicId}/assignee`, 'padmin', { login: 'bob' })).status).toBe(200)
    expect(stories.assigneeOf(epicId)).toBe('bob')
  })

  it('lets a member claim an unassigned epic for himself but not hand it to someone else', async () => {
    expect((await call('PUT', `/api/epics/${alone.epicId}/assignee`, 'bob', { login: 'alice' })).status).toBe(403)
    expect((await call('PUT', `/api/epics/${alone.epicId}/assignee`, 'bob', { login: 'bob' })).status).toBe(200)
    expect(stories.assigneeOf(alone.epicId)).toBe('bob')
  })
})

describe('every mutating route under a story or an epic', () => {
  it('is closed to a plain member while another member holds the epic', async () => {
    const mutating = app.routes.filter(
      (route) =>
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method) &&
        /^\/api\/(stories|epics)\/:id(\/|$)/.test(route.path) &&
        !route.path.endsWith('/claim'),
    )
    expect(mutating.length).toBeGreaterThan(15)
    for (const route of mutating) {
      const path = route.path
        .replace('/api/epics/:id', `/api/epics/${epicId}`)
        .replace('/api/stories/:id', `/api/stories/${storyId}`)
        .replace(/:[a-zA-Z]+/g, '1')
      const answer = await call(route.method, path, 'bob', {})
      expect(answer.status, `${route.method} ${route.path}`).toBe(409)
    }
  })
})
