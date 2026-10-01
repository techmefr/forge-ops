import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createIdentityRepository } from '../../../src/domain/Identity/IdentityRepository.js'
import { createProjectApi } from '../../../src/domain/Project/ProjectApi.js'
import { mapApiError } from '../../../src/domain/Board/ApiErrorMap.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'

let db: Database.Database
let stories: StoryRepository
let app: Hono
let alphaId: number
let betaId: number
let anaId: number
let bobId: number

const PASSWORD = 'un mot de passe assez long'

function project(slug: string, name: string): number {
  return stories.createProject({
    slug,
    name,
    repositoryUrl: `git@example.com:${slug}.git`,
    integrationBranch: 'main',
    colour: '#112233',
  }).id
}

function deactivate(login: string): void {
  db.prepare("UPDATE board_user SET disabled_at = datetime('now') WHERE login = ?").run(login)
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  const identities = createIdentityRepository(db)
  anaId = identities.enrolUser({ login: 'ana', displayName: 'Ana', password: PASSWORD, role: 'architect' }).id
  bobId = identities.enrolUser({ login: 'bob', displayName: 'Bob', password: PASSWORD, role: 'architect' }).id
  identities.bootstrapSuperAdmin({ login: 'root', password: PASSWORD })
  alphaId = project('alpha', 'Alpha')
  betaId = project('beta', 'Beta')
  app = new Hono()
  app.use('*', async (context, next) => {
    const login = context.req.header('x-login')
    if (login !== undefined) {
      context.set('login', login)
    }
    await next()
  })
  app.onError(mapApiError)
  app.route(
    '/',
    createProjectApi({
      projects: stories.projects,
      events: createEventBus(),
      isSuperAdmin: (login) => identities.findUser(login)?.superAdmin ?? false,
      isDirector: (login) => identities.findUser(login)?.role === 'director',
    }),
  )
})

function call(method: string, path: string, body?: unknown, login?: string): Promise<Response> {
  return app.request(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(login === undefined ? {} : { 'x-login': login }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Response>
}

async function sheets<T>(): Promise<T[]> {
  return (await (await call('GET', '/api/projects/sheets')).json()) as T[]
}

describe('GET /api/projects/sheets', () => {
  it('lists the projects in order with admin, links and usage', async () => {
    stories.createEpic({ projectId: alphaId, title: 'Sujet', businessIntent: 'x' })

    const listed = await sheets<Record<string, unknown>>()

    expect(listed.map((sheet) => sheet.slug)).toEqual(['alpha', 'beta'])
    expect(listed[0]).toMatchObject({
      colour: '#112233',
      position: 0,
      adminUserId: null,
      adminLogin: null,
      links: [],
      usage: 1,
    })
    expect(listed[1]).toMatchObject({ position: 1, usage: 0 })
  })
})

describe('PUT /api/projects/:id', () => {
  it('changes the colour, the position and the links together', async () => {
    const response = await call('PUT', `/api/projects/${betaId}`, {
      colour: '#ABCDEF',
      position: 0,
      links: [{ kind: 'repo', url: 'https://example.com/beta' }],
    })

    expect(response.status).toBe(200)
    const listed = await sheets<{ slug: string; colour: string; links: unknown[] }>()
    expect(listed.map((sheet) => sheet.slug)).toEqual(['beta', 'alpha'])
    expect(listed[0]).toMatchObject({
      colour: '#ABCDEF',
      links: [{ kind: 'repo', url: 'https://example.com/beta' }],
    })
  })

  it('refuses a colour that is not a hex code, an empty update and an unknown key', async () => {
    expect((await call('PUT', `/api/projects/${alphaId}`, { colour: 'red' })).status).toBe(422)
    expect((await call('PUT', `/api/projects/${alphaId}`, {})).status).toBe(422)
    expect((await call('PUT', `/api/projects/${alphaId}`, { name: 'Autre' })).status).toBe(422)
  })

  it('answers 404 for an unknown project', async () => {
    expect((await call('PUT', '/api/projects/999', { position: 1 })).status).toBe(404)
  })

  it('names an admin on a project that has none, for a super admin', async () => {
    const response = await call('PUT', `/api/projects/${alphaId}`, { adminId: anaId }, 'root')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ adminUserId: anaId, adminLogin: 'ana', adminName: 'Ana' })
  })

  it('refuses a plain member naming an admin on a project that has none', async () => {
    expect((await call('PUT', `/api/projects/${alphaId}`, { adminId: anaId }, 'bob')).status).toBe(403)
  })

  it('lets the current admin hand the project over', async () => {
    await call('PUT', `/api/projects/${alphaId}`, { adminId: anaId })

    const response = await call('PUT', `/api/projects/${alphaId}`, { adminId: bobId }, 'ana')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ adminLogin: 'bob' })
  })

  it('lets a super admin change the admin', async () => {
    await call('PUT', `/api/projects/${alphaId}`, { adminId: anaId })

    expect((await call('PUT', `/api/projects/${alphaId}`, { adminId: bobId }, 'root')).status).toBe(200)
  })

  it('answers 403 to anyone else and leaves the admin alone', async () => {
    await call('PUT', `/api/projects/${alphaId}`, { adminId: anaId })

    const response = await call('PUT', `/api/projects/${alphaId}`, { adminId: bobId }, 'bob')

    expect(response.status).toBe(403)
    const listed = await sheets<{ adminLogin: string | null }>()
    expect(listed[0]?.adminLogin).toBe('ana')
  })

  it('lets anyone change the colour while the admin stays the same', async () => {
    await call('PUT', `/api/projects/${alphaId}`, { adminId: anaId })

    const response = await call('PUT', `/api/projects/${alphaId}`, { colour: '#000000', adminId: anaId }, 'bob')

    expect(response.status).toBe(200)
  })

  it('refuses a deactivated or unknown user as admin', async () => {
    deactivate('bob')

    expect((await call('PUT', `/api/projects/${alphaId}`, { adminId: bobId })).status).toBe(409)
    expect((await call('PUT', `/api/projects/${alphaId}`, { adminId: 999 })).status).toBe(409)
  })

  it('keeps a deactivated user as admin until somebody replaces them', async () => {
    await call('PUT', `/api/projects/${alphaId}`, { adminId: bobId })
    deactivate('bob')

    const response = await call('PUT', `/api/projects/${alphaId}`, { adminId: bobId, colour: '#000001' }, 'root')

    expect(response.status).toBe(200)
  })

  it('clears the admin', async () => {
    await call('PUT', `/api/projects/${alphaId}`, { adminId: anaId })

    const response = await call('PUT', `/api/projects/${alphaId}`, { adminId: null }, 'ana')

    expect(await response.json()).toMatchObject({ adminUserId: null, adminLogin: null })
  })
})

describe('DELETE /api/projects/:id', () => {
  it('deletes a project nothing uses, with its links', async () => {
    await call('PUT', `/api/projects/${betaId}`, { links: [{ kind: 'doc', url: 'https://example.com/d' }] })

    const response = await call('DELETE', `/api/projects/${betaId}`)

    expect(response.status).toBe(200)
    const listed = await sheets<{ slug: string }>()
    expect(listed.map((sheet) => sheet.slug)).toEqual(['alpha'])
    expect(db.prepare('SELECT COUNT(*) AS total FROM project_link').get()).toEqual({ total: 0 })
  })

  it('deletes the workflow steps of the project with it', async () => {
    db.prepare("INSERT INTO workflow_column (project_id, key, label, colour, position) VALUES (?, 'spec', 'Spec', 'acc', 1)").run(betaId)

    expect((await call('DELETE', `/api/projects/${betaId}`)).status).toBe(200)

    expect(db.prepare('SELECT COUNT(*) AS total FROM workflow_column').get()).toEqual({ total: 0 })
  })

  it('deletes the events of the project with it', async () => {
    db.prepare("INSERT INTO epic_milestone (project_id, kind, due_on, title) VALUES (?, 'demo', '2030-01-01', 'Go live')").run(betaId)

    expect((await call('DELETE', `/api/projects/${betaId}`)).status).toBe(200)

    expect(db.prepare('SELECT COUNT(*) AS total FROM epic_milestone').get()).toEqual({ total: 0 })
  })

  it('answers 409 with the reason while subjects use it', async () => {
    stories.createEpic({ projectId: alphaId, title: 'A', businessIntent: 'x' })
    stories.createEpic({ projectId: alphaId, title: 'B', businessIntent: 'x' })

    const response = await call('DELETE', `/api/projects/${alphaId}`)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: 'ProjectInUseError',
      reason: 'used by 2 subjects',
      usage: 2,
    })
  })

  it('counts a subject in the trash as a use', async () => {
    const epic = stories.createEpic({ projectId: alphaId, title: 'A', businessIntent: 'x' })
    stories.epics.softDelete(epic.id, 'ana')

    expect((await call('DELETE', `/api/projects/${alphaId}`)).status).toBe(409)
  })

  it('answers 404 for an unknown project', async () => {
    expect((await call('DELETE', '/api/projects/999')).status).toBe(404)
  })
})

describe('creating a project', () => {
  it('puts the new project last', async () => {
    const gammaId = project('gamma', 'Gamma')

    const listed = await sheets<{ id: number }>()

    expect(listed.map((sheet) => sheet.id)).toEqual([alphaId, betaId, gammaId])
  })
})

describe('assigning a subject', () => {
  it('refuses a deactivated account', () => {
    const epic = stories.createEpic({ projectId: alphaId, title: 'A', businessIntent: 'x' })
    deactivate('bob')

    expect(() => stories.claimEpic(epic.id, 'bob')).toThrow(/deactivated/)
  })

  it('keeps a deactivated account on the subjects it already holds', () => {
    const epic = stories.createEpic({ projectId: alphaId, title: 'A', businessIntent: 'x' })
    stories.claimEpic(epic.id, 'bob')
    deactivate('bob')

    const listed = stories.listEpics(alphaId, { today: '2026-09-29' })

    expect(listed[0]?.assignee).toBe('bob')
  })
})
