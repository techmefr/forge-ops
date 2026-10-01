import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createIdentityRepository } from '../../../src/domain/Identity/IdentityRepository.js'
import { createProjectApi } from '../../../src/domain/Project/ProjectApi.js'
import { createEpicApi } from '../../../src/domain/Epic/EpicApi.js'
import { mapApiError } from '../../../src/domain/Board/ApiErrorMap.js'
import { createWorkflowColumnApi } from '../../../src/domain/Workflow/WorkflowColumnApi.js'
import { createWorkflowColumnRepository } from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import { mayAdministerProject } from '../../../src/domain/Project/ProjectAuthority.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'

const PASSWORD = 'un mot de passe assez long'

let db: Database.Database
let app: Hono
let projectId: number
let anaId: number
let openId: number

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
  identities.enrolUser({ login: 'dir', displayName: 'Dir', password: PASSWORD, role: 'director' })
  identities.bootstrapSuperAdmin({ login: 'root', password: PASSWORD })
  projectId = stories.createProject({
    slug: 'alpha',
    name: 'Alpha',
    repositoryUrl: 'git@example.com:alpha.git',
    integrationBranch: 'main',
    colour: '#112233',
  }).id
  openId = stories.createProject({
    slug: 'beta',
    name: 'Beta',
    repositoryUrl: 'git@example.com:beta.git',
    integrationBranch: 'main',
    colour: '#445566',
  }).id
  const isSuperAdmin = (login: string): boolean => identities.findUser(login)?.superAdmin ?? false
  const isDirector = (login: string): boolean => identities.findUser(login)?.role === 'director'
  app = new Hono()
  app.use('*', async (context, next) => {
    const login = context.req.header('x-login')
    if (login !== undefined) {
      context.set('login', login)
    }
    await next()
  })
  app.onError(mapApiError)
  app.route('/', createProjectApi({ projects: stories.projects, events: createEventBus(), isSuperAdmin, isDirector }))
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
  app.route(
    '/',
    createWorkflowColumnApi({
      columns: createWorkflowColumnRepository(db),
      projectExists: (id) => stories.projects.find(id) !== null,
      mayAdminister: (id, context) =>
        mayAdministerProject({
          login: context.get('login') ?? 'local',
          adminLogin: stories.projects.find(id)?.adminLogin ?? null,
          isSuperAdmin,
          isDirector,
        }),
      adminOf: () => null,
    }),
  )
  await call('PUT', `/api/projects/${projectId}`, undefined, { adminId: anaId })
})

describe('who may delete a project or rewrite its links', () => {
  it('refuses a member who is not the admin and keeps the project', async () => {
    expect((await call('DELETE', `/api/projects/${projectId}`, 'bob')).status).toBe(403)
    expect(db.prepare('SELECT COUNT(*) AS total FROM project').get()).toEqual({ total: 2 })
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

describe('a project without admin', () => {
  const WORKFLOW_STEP = {
    label: 'Spec',
    colour: 'acc',
    provider: 'claude',
    model: 'claude-sonnet-5',
    effort: 'high',
    agentName: '',
    command: '',
    preprompt: '',
    autoStart: true,
  }

  it('refuses a plain member on the project routes and the workflow route alike', async () => {
    expect((await call('PUT', `/api/projects/${openId}`, 'bob', { adminId: anaId })).status).toBe(403)
    expect((await call('PUT', `/api/projects/${openId}`, 'bob', LINKS)).status).toBe(403)
    expect((await call('PUT', `/api/projects/${openId}/links`, 'bob', LINKS)).status).toBe(403)
    expect((await call('DELETE', `/api/projects/${openId}`, 'bob')).status).toBe(403)
    expect((await call('POST', `/api/projects/${openId}/workflow-columns`, 'bob', WORKFLOW_STEP)).status).toBe(403)
  })

  it('lets a director claim it, after which the new admin alone edits it', async () => {
    expect((await call('PUT', `/api/projects/${openId}`, 'dir', { adminId: anaId })).status).toBe(200)
    expect((await call('PUT', `/api/projects/${openId}`, 'dir', LINKS)).status).toBe(403)
  })

  it('lets a director settle the workflow and delete it while it has no admin', async () => {
    expect((await call('POST', `/api/projects/${openId}/workflow-columns`, 'dir', WORKFLOW_STEP)).status).toBe(201)
    expect((await call('DELETE', `/api/projects/${openId}`, 'dir')).status).toBe(200)
  })

  it('lets a super admin do the same', async () => {
    expect((await call('POST', `/api/projects/${openId}/workflow-columns`, 'root', WORKFLOW_STEP)).status).toBe(201)
    expect((await call('PUT', `/api/projects/${openId}/links`, 'root', LINKS)).status).toBe(200)
  })
})
