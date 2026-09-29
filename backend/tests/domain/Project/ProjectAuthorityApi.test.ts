import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createIdentityRepository } from '../../../src/domain/Identity/IdentityRepository.js'
import { createProjectApi } from '../../../src/domain/Project/ProjectApi.js'
import { createEpicApi } from '../../../src/domain/Epic/EpicApi.js'
import { mapApiError } from '../../../src/domain/Board/ApiErrorMap.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'

const PASSWORD = 'un mot de passe assez long'

let db: Database.Database
let app: Hono
let projectId: number
let anaId: number

function call(method: string, path: string, login?: string, body?: unknown): Promise<Response> {
  return app.request(path, {
    method,
    headers: { 'content-type': 'application/json', ...(login === undefined ? {} : { 'x-login': login }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

const LINKS = { links: [{ kind: 'doc', url: 'https://example.com/d' }] }

beforeEach(async () => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const identities = createIdentityRepository(db)
  anaId = identities.enrolUser({ login: 'ana', displayName: 'Ana', password: PASSWORD, role: 'architect' }).id
  identities.enrolUser({ login: 'bob', displayName: 'Bob', password: PASSWORD, role: 'architect' })
  identities.bootstrapSuperAdmin({ login: 'root', password: PASSWORD })
  projectId = stories.createProject({
    slug: 'alpha',
    name: 'Alpha',
    repositoryUrl: 'git@example.com:alpha.git',
    integrationBranch: 'main',
    colour: '#112233',
  }).id
  const isSuperAdmin = (login: string): boolean => identities.findUser(login)?.superAdmin ?? false
  app = new Hono()
  app.use('*', async (context, next) => {
    const login = context.req.header('x-login')
    if (login !== undefined) {
      context.set('login', login)
    }
    await next()
  })
  app.onError(mapApiError)
  app.route('/', createProjectApi({ projects: stories.projects, events: createEventBus(), isSuperAdmin }))
  app.route(
    '/',
    createEpicApi({
      epics: stories.epics,
      events: createEventBus(),
      today: () => '2026-09-01',
      projects: stories.projects,
      isSuperAdmin,
    }),
  )
  await call('PUT', `/api/projects/${projectId}`, undefined, { adminId: anaId })
})

describe('who may delete a project or rewrite its links', () => {
  it('refuses a member who is not the admin and keeps the project', async () => {
    expect((await call('DELETE', `/api/projects/${projectId}`, 'bob')).status).toBe(403)
    expect(db.prepare('SELECT COUNT(*) AS total FROM project').get()).toEqual({ total: 1 })
  })

  it('lets the admin and a super admin delete', async () => {
    expect((await call('DELETE', `/api/projects/${projectId}`, 'ana')).status).toBe(200)
  })

  it('refuses links written through the project update by a non admin', async () => {
    expect((await call('PUT', `/api/projects/${projectId}`, 'bob', LINKS)).status).toBe(403)
    expect((await call('PUT', `/api/projects/${projectId}`, 'ana', LINKS)).status).toBe(200)
  })

  it('refuses links written through the links route by a non admin', async () => {
    expect((await call('PUT', `/api/projects/${projectId}/links`, 'bob', LINKS)).status).toBe(403)
    expect((await call('PUT', `/api/projects/${projectId}/links`, 'root', LINKS)).status).toBe(200)
  })
})
