import { beforeEach, describe, expect, it } from 'vitest'
import type { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createPilotRepository } from '../../../src/domain/Pilot/PilotRepository.js'
import { createPilotApi } from '../../../src/domain/Pilot/PilotApi.js'
import { createEventBus, type BoardEvent } from '../../../src/technical/Http/EventBus.js'
import type { PilotDriver } from '../../../src/domain/Pilot/Pilot.js'

let api: Hono
let storyId: number
let seen: BoardEvent[]
let refuse: boolean
let db: ReturnType<typeof openDatabase>
let stories: ReturnType<typeof createStoryRepository>

const SCRIPT = [
  { kind: 'goto', target: 'http://localhost:5049/mails' },
  { kind: 'click', target: '[data-test-id=compose]' },
]

function driver(): PilotDriver {
  return {
    open: () => Promise.resolve(),
    perform: () => {
      if (refuse) {
        return Promise.reject(new Error('introuvable'))
      }
      return Promise.resolve({ detail: 'fait', screenshotPath: null, consoleErrors: [] })
    },
    inspect: () => Promise.resolve({ detail: 'la page', screenshotPath: null, consoleErrors: [] }),
    close: () => Promise.resolve(),
  }
}

function send(path: string, method: string, body?: unknown): Promise<Response> {
  return api.request(path, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  }) as Promise<Response>
}

function startRun(body: unknown = { url: 'http://localhost:5049/mails', pace: 'slow', script: SCRIPT }) {
  return send(`/api/stories/${storyId}/pilot`, 'POST', body)
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  seen = []
  refuse = false
  const events = createEventBus()
  events.subscribe((event) => seen.push(event))
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que' }).id
  api = createPilotApi({ pilots: createPilotRepository(db, { stories, openDriver: driver }), events })
})

describe('POST /api/stories/:id/pilot', () => {
  it('starts a run', async () => {
    expect((await startRun()).status).toBe(201)
  })

  it('announces it so every open board follows along', async () => {
    await startRun()

    expect(seen.map((event) => event.name)).toContain('pilot.started')
  })

  it('refuses an unknown story', async () => {
    const response = await send('/api/stories/9999/pilot', 'POST', {
      url: 'http://x.test/',
      pace: 'slow',
      script: SCRIPT,
    })

    expect(response.status).toBe(404)
  })

  it('refuses an empty script', async () => {
    expect((await startRun({ url: 'http://x.test/', pace: 'slow', script: [] })).status).toBe(422)
  })

  it('refuses an unknown pace', async () => {
    expect(
      (await startRun({ url: 'http://x.test/', pace: 'sprint', script: SCRIPT })).status,
    ).toBe(422)
  })

  it('refuses a destination that is not a web address', async () => {
    expect((await startRun({ url: 'file:///etc/passwd', pace: 'slow', script: SCRIPT })).status).toBe(
      422,
    )
  })

  it('refuses a second run on the same story', async () => {
    await startRun()

    expect((await startRun()).status).toBe(409)
  })
})

describe('POST /api/stories/:id/pilot/advance', () => {
  it('walks one step', async () => {
    await startRun()

    const response = await send(`/api/stories/${storyId}/pilot/advance`, 'POST')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ position: 1 })
  })

  it('announces each step', async () => {
    await startRun()
    seen = []
    await send(`/api/stories/${storyId}/pilot/advance`, 'POST')

    expect(seen.map((event) => event.name)).toContain('pilot.advanced')
  })

  it('refuses to walk a story with no run', async () => {
    expect((await send(`/api/stories/${storyId}/pilot/advance`, 'POST')).status).toBe(404)
  })

  it('refuses to walk a run whose browser did not survive the board', async () => {
    await startRun()
    api = createPilotApi({
      pilots: createPilotRepository(db, { stories, openDriver: driver }),
      events: createEventBus(),
    })

    expect((await send(`/api/stories/${storyId}/pilot/advance`, 'POST')).status).toBe(409)
  })

  it('refuses to walk a run that already failed', async () => {
    await startRun()
    refuse = true
    await send(`/api/stories/${storyId}/pilot/advance`, 'POST')

    expect((await send(`/api/stories/${storyId}/pilot/advance`, 'POST')).status).toBe(409)
  })
})

describe('pause, resume and inspect', () => {
  it('pauses the run', async () => {
    await startRun()

    await expect((await send(`/api/stories/${storyId}/pilot/pause`, 'POST')).json()).resolves.toMatchObject(
      { state: 'paused' },
    )
  })

  it('resumes the run', async () => {
    await startRun()
    await send(`/api/stories/${storyId}/pilot/pause`, 'POST')

    await expect(
      (await send(`/api/stories/${storyId}/pilot/resume`, 'POST')).json(),
    ).resolves.toMatchObject({ state: 'running' })
  })

  it('reads the page it is looking at', async () => {
    await startRun()

    await expect((await send(`/api/stories/${storyId}/pilot/inspect`, 'POST')).json()).resolves.toMatchObject(
      { detail: 'la page' },
    )
  })

  it('refuses to pause a story with no run', async () => {
    expect((await send(`/api/stories/${storyId}/pilot/pause`, 'POST')).status).toBe(404)
  })
})

describe('DELETE /api/stories/:id/pilot', () => {
  it('abandons the run', async () => {
    await startRun()

    await expect((await send(`/api/stories/${storyId}/pilot`, 'DELETE')).json()).resolves.toMatchObject({
      state: 'abandoned',
    })
  })

  it('announces the abandon', async () => {
    await startRun()
    seen = []
    await send(`/api/stories/${storyId}/pilot`, 'DELETE')

    expect(seen.map((event) => event.name)).toContain('pilot.ended')
  })
})

describe('GET /api/stories/:id/pilot', () => {
  it('rends nothing before any run', async () => {
    const response = await send(`/api/stories/${storyId}/pilot`, 'GET')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ run: null, history: [] })
  })

  it('rends the live run and its past ones', async () => {
    await startRun()

    await expect((await send(`/api/stories/${storyId}/pilot`, 'GET')).json()).resolves.toMatchObject({
      run: { state: 'running' },
      history: [{ state: 'running' }],
    })
  })
})

describe('GET /api/pilots', () => {
  it('lists what the board is watching right now', async () => {
    await startRun()

    await expect((await send('/api/pilots', 'GET')).json()).resolves.toHaveLength(1)
  })
})
