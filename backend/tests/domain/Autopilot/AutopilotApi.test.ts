import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAutopilotApi } from '../../../src/domain/Autopilot/AutopilotApi.js'
import { createAutopilotRepository } from '../../../src/domain/Autopilot/AutopilotRepository.js'

let db: Database.Database
let projectId: number
let mayAdminister: boolean
let api: ReturnType<typeof createAutopilotApi>

async function ask(path: string, method = 'GET', body?: unknown): Promise<Response> {
  return (await api.request(path, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })) as Response
}

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  mayAdminister = true
  api = createAutopilotApi({
    autopilot: createAutopilotRepository(db),
    projectExists: (id) => id === projectId,
    mayAdminister: () => mayAdminister,
  })
})

describe('the autopilot settings API', () => {
  it('answers the defaults of a project that never settled anything', async () => {
    const response = await ask(`/api/projects/${projectId}/autopilot`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      enabled: true,
      autoLaunch: true,
      autoPublish: true,
      autoMerge: false,
      maySettle: true,
    })
  })

  it('settles the switches of the project', async () => {
    const response = await ask(`/api/projects/${projectId}/autopilot`, 'PUT', {
      enabled: false,
      autoLaunch: false,
      autoPublish: true,
      autoMerge: true,
    })

    expect(response.status).toBe(200)
    expect(await (await ask(`/api/projects/${projectId}/autopilot`)).json()).toMatchObject({
      enabled: false,
      autoLaunch: false,
      autoMerge: true,
    })
  })

  it('refuses a user who does not administer the project', async () => {
    mayAdminister = false

    const response = await ask(`/api/projects/${projectId}/autopilot`, 'PUT', {
      enabled: false,
      autoLaunch: true,
      autoPublish: true,
      autoMerge: false,
    })

    expect(response.status).toBe(403)
    expect(await (await ask(`/api/projects/${projectId}/autopilot`)).json()).toMatchObject({ enabled: true })
  })

  it('refuses incomplete settings and unknown projects', async () => {
    expect((await ask(`/api/projects/${projectId}/autopilot`, 'PUT', { enabled: false })).status).toBe(422)
    expect((await ask('/api/projects/999/autopilot')).status).toBe(404)
  })
})
