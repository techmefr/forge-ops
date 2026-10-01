import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createIdentityRepository } from '../../../src/domain/Identity/IdentityRepository.js'
import { createFollowUpApi } from '../../../src/domain/FollowUp/FollowUpApi.js'
import { mapApiError } from '../../../src/domain/Board/ApiErrorMap.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'

const PASSWORD = 'un mot de passe assez long'

let app: Hono
let projectId: number

function call(body: unknown, login?: string): Promise<Response> {
  return app.request(`/api/projects/${projectId}/weather`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(login === undefined ? {} : { 'x-login': login }),
    },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

beforeEach(() => {
  const db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const identities = createIdentityRepository(db)
  const anaId = identities.enrolUser({ login: 'ana', displayName: 'Ana', password: PASSWORD, role: 'architect' }).id
  identities.enrolUser({ login: 'bob', displayName: 'Bob', password: PASSWORD, role: 'architect' })
  identities.bootstrapSuperAdmin({ login: 'root', password: PASSWORD })
  projectId = stories.createProject({
    slug: 'alpha',
    name: 'Alpha',
    repositoryUrl: 'git@example.com:alpha.git',
    integrationBranch: 'main',
    colour: '#112233',
  }).id
  stories.projects.update(projectId, { adminId: anaId })
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
    createFollowUpApi({
      followUps: stories.followUps,
      projects: stories.projects,
      events: createEventBus(),
      today: () => '2026-09-29',
      isSuperAdmin: (login) => identities.findUser(login)?.superAdmin ?? false,
      isDirector: (login) => identities.findUser(login)?.role === 'director',
    }),
  )
})

describe('who may set the weather by hand', () => {
  it('lets the project admin set it', async () => {
    expect((await call({ weather: 'stormy' }, 'ana')).status).toBe(200)
  })

  it('lets a super admin set it', async () => {
    expect((await call({ weather: 'stormy' }, 'root')).status).toBe(200)
  })

  it('answers 403 to anyone else and leaves the weather alone', async () => {
    const response = await call({ weather: 'stormy', statusSentence: 'Hacked' }, 'bob')
    expect(response.status).toBe(403)
    const followUp = await app.request(`/api/projects/${projectId}/follow-up`)
    expect(await followUp.json()).toMatchObject({ weather: 'sunny', source: 'computed', statusSentence: null })
  })
})
