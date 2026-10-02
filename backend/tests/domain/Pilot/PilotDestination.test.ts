import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createPilotRepository } from '../../../src/domain/Pilot/PilotRepository.js'
import { createPilotApi } from '../../../src/domain/Pilot/PilotApi.js'
import {
  createDestinationPolicy,
  parseAllowedOrigins,
  type DestinationPolicy,
} from '../../../src/domain/Pilot/PilotDestination.js'
import { UnsafeDestinationError } from '../../../src/domain/Pilot/PilotViolation.js'
import { createPlaywrightPilot } from '../../../src/technical/Browser/PlaywrightPilot.js'
import { createEventBus } from '../../../src/technical/Http/EventBus.js'
import { isPublicAddress } from '../../../src/technical/Network/HostAddress.js'
import type { PilotDriver, PilotStep } from '../../../src/domain/Pilot/Pilot.js'

const RESOLUTIONS: Record<string, readonly string[]> = {
  'public.test': ['93.184.216.34'],
  'internal.test': ['10.0.0.8'],
  'mixed.test': ['93.184.216.34', '169.254.169.254'],
  'metadata.test': ['169.254.169.254'],
  'localhost': ['127.0.0.1'],
  'v6.test': ['2606:2800:220:1:248:1893:25c8:1946'],
  'mapped.test': ['::ffff:127.0.0.1'],
}

function resolveFromTable(hostname: string): Promise<readonly string[]> {
  const found = RESOLUTIONS[hostname]
  return found === undefined ? Promise.reject(new Error('ENOTFOUND')) : Promise.resolve(found)
}

function policy(previewPort: number | null = null, allowedOrigins: readonly string[] = []): DestinationPolicy {
  return createDestinationPolicy({
    previewPortOf: () => previewPort,
    allowedOrigins,
    resolve: resolveFromTable,
  })
}

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '127.9.9.9',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    'not an address',
  ])('refuses %s', (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })

  it.each(['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:2800:220:1:248:1893:25c8:1946'])(
    'accepts %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true)
    },
  )
})

describe('destination policy', () => {
  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1:8830/api/board/self',
    'http://localhost:8830/',
    'http://[::1]:8830/',
    'http://10.0.0.8/',
    'http://2130706433/',
    'http://0x7f.1/',
    'http://017700000001/',
    'http://[::ffff:127.0.0.1]/',
    'http://internal.test/',
    'http://metadata.test/',
    'http://mixed.test/',
    'http://mapped.test/',
    'http://unknown.test/',
    'file:///etc/passwd',
    'ftp://public.test/',
    'javascript:alert(1)',
    'data:text/html,hello',
    'not a url',
  ])('refuses %s', async (target) => {
    expect(await policy().isAllowed(target, 1)).toBe(false)
    await expect(policy().assertAllowed(target, 1)).rejects.toBeInstanceOf(UnsafeDestinationError)
  })

  it.each(['http://public.test/', 'https://public.test:8443/x?y=1', 'http://93.184.216.34/', 'http://v6.test/'])(
    'accepts %s',
    async (target) => {
      expect(await policy().isAllowed(target, 1)).toBe(true)
    },
  )

  it('accepts the loopback preview of the story and nothing else on loopback', async () => {
    const withPreview = policy(5049)
    expect(await withPreview.isAllowed('http://localhost:5049/mails', 1)).toBe(true)
    expect(await withPreview.isAllowed('http://127.0.0.1:5049/', 1)).toBe(true)
    expect(await withPreview.isAllowed('http://localhost:5050/', 1)).toBe(false)
    expect(await withPreview.isAllowed('http://127.0.0.1:8830/api/board/self', 1)).toBe(false)
    expect(await withPreview.isAllowed('https://localhost:5049/', 1)).toBe(false)
  })

  it('accepts an origin from the admin allow-list and only that origin', async () => {
    const listed = policy(null, parseAllowedOrigins('http://internal.test:3000, nonsense, https://tools.test'))
    expect(await listed.isAllowed('http://internal.test:3000/app', 1)).toBe(true)
    expect(await listed.isAllowed('http://internal.test:3001/app', 1)).toBe(false)
    expect(await listed.isAllowed('http://internal.test/', 1)).toBe(false)
  })
})

describe('the pilot repository', () => {
  let db: ReturnType<typeof openDatabase>
  let stories: StoryRepository
  let storyId: number
  let opened: string[]

  const driver = (): PilotDriver => ({
    open: (url) => {
      opened.push(url)
      return Promise.resolve()
    },
    perform: () => Promise.resolve({ detail: 'ok', screenshotPath: null, consoleErrors: [] }),
    inspect: () => Promise.resolve({ detail: 'ok', screenshotPath: null, consoleErrors: [] }),
    close: () => Promise.resolve(),
  })

  beforeEach(() => {
    db = openDatabase(':memory:')
    stories = createStoryRepository(db)
    opened = []
    const project = stories.createProject({
      slug: 'forge',
      name: 'Forge',
      repositoryUrl: 'git@example.com:forge.git',
      integrationBranch: 'main',
      colour: '#ff3b00',
    })
    const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
    storyId = stories.writeStory({ epicId: epic.id, title: 'une carte', body: 'corps' }).id
  })

  function repository(): ReturnType<typeof createPilotRepository> {
    return createPilotRepository(db, { stories, openDriver: driver, destinations: policy() })
  }

  const script = (target: string): readonly PilotStep[] => [
    { kind: 'goto', target },
    { kind: 'screenshot', target: 'x' },
  ]

  it('never opens a browser on the metadata service', async () => {
    const pilots = repository()
    await expect(
      pilots.start({
        storyId,
        url: 'http://169.254.169.254/latest/meta-data/',
        pace: 'live',
        script: script('http://169.254.169.254/'),
      }),
    ).rejects.toBeInstanceOf(UnsafeDestinationError)
    expect(opened).toEqual([])
    expect(pilots.listLive()).toEqual([])
  })

  it('refuses an internal host hidden in a later goto step', async () => {
    const pilots = repository()
    await expect(
      pilots.start({ storyId, url: 'http://public.test/', pace: 'live', script: script('http://127.0.0.1:8830/') }),
    ).rejects.toBeInstanceOf(UnsafeDestinationError)
    expect(opened).toEqual([])
  })

  it('opens a public destination', async () => {
    const pilots = repository()
    await pilots.start({ storyId, url: 'http://public.test/', pace: 'live', script: script('http://public.test/a') })
    expect(opened).toEqual(['http://public.test/'])
  })
})

describe('POST /api/stories/:id/pilot', () => {
  it('refuses a member who does not hold the story and an internal url, both', async () => {
    const db = openDatabase(':memory:')
    const stories = createStoryRepository(db)
    const project = stories.createProject({
      slug: 'forge',
      name: 'Forge',
      repositoryUrl: 'git@example.com:forge.git',
      integrationBranch: 'main',
      colour: '#ff3b00',
    })
    const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
    const storyId = stories.writeStory({ epicId: epic.id, title: 'une carte', body: 'corps' }).id
    stories.assignEpic(epic.id, 'alice')
    const app = new Hono()
    app.use('*', async (context, next) => {
      context.set('login', context.req.header('x-login') ?? 'local')
      await next()
    })
    app.route(
      '/',
      createPilotApi({
        pilots: createPilotRepository(db, {
          stories,
          openDriver: () => ({
            open: () => Promise.resolve(),
            perform: () => Promise.resolve({ detail: 'ok', screenshotPath: null, consoleErrors: [] }),
            inspect: () => Promise.resolve({ detail: 'ok', screenshotPath: null, consoleErrors: [] }),
            close: () => Promise.resolve(),
          }),
          destinations: policy(),
        }),
        events: createEventBus(),
        suggest: () => ({ url: '', script: [], reason: 'noCriteria' as const, references: [] }),
        mayRun: (id, context) => stories.assigneeOf(stories.findStory(id).epicId) === context.get('login'),
      }),
    )
    const attack = {
      url: 'http://169.254.169.254/latest/meta-data/',
      pace: 'live',
      script: [{ kind: 'goto', target: 'http://169.254.169.254/' }],
    }
    const send = (login: string, body: unknown): Promise<Response> =>
      app.request(`/api/stories/${storyId}/pilot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-login': login },
        body: JSON.stringify(body),
      }) as Promise<Response>

    expect((await send('bob', attack)).status).toBe(403)
    expect((await send('alice', attack)).status).toBe(422)
    const fine = { url: 'http://public.test/', pace: 'live', script: [{ kind: 'screenshot', target: 'x' }] }
    expect((await send('bob', fine)).status).toBe(403)
    expect((await send('alice', fine)).status).toBe(201)
  })
})

describe('the real browser', () => {
  let origin: Server
  let internal: Server
  let originUrl = ''
  let internalHits = 0
  let pilot: PilotDriver

  beforeAll(async () => {
    internal = createServer((_request, response) => {
      internalHits += 1
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<main>secret internal page</main>')
    })
    await new Promise<void>((listening) => internal.listen(0, '127.0.0.1', listening))
    const internalAddress = internal.address()
    const internalPort = typeof internalAddress === 'object' && internalAddress !== null ? internalAddress.port : 0
    origin = createServer((request, response) => {
      if (request.url === '/hop') {
        response.writeHead(302, { location: `http://127.0.0.1:${internalPort}/` })
        response.end()
        return
      }
      response.writeHead(200, { 'content-type': 'text/html' })
      const source = request.url === '/redirected-image' ? '/hop' : `http://127.0.0.1:${internalPort}/pixel.png`
      response.end(`<main>preview</main><img src="${source}">`)
    })
    await new Promise<void>((listening) => origin.listen(0, '127.0.0.1', listening))
    const originAddress = origin.address()
    const originPort = typeof originAddress === 'object' && originAddress !== null ? originAddress.port : 0
    originUrl = `http://127.0.0.1:${originPort}`
    const guarded = policy(originPort)
    pilot = createPlaywrightPilot({
      shotDir: mkdtempSync(join(tmpdir(), 'forge-shots-')),
      guard: (target) => guarded.isAllowed(target, 1),
    })
    await pilot.open(`${originUrl}/`, 'live')
  })

  afterAll(async () => {
    await pilot.close()
    await new Promise<void>((closed) => origin.close(() => closed()))
    await new Promise<void>((closed) => internal.close(() => closed()))
  })

  it('does not follow a navigation redirect to a host the policy refuses', async () => {
    await pilot.perform({ kind: 'goto', target: `${originUrl}/hop` }).catch(() => undefined)
    await new Promise((settled) => setTimeout(settled, 700))
    expect(internalHits).toBe(0)
  })

  it('does not follow a subresource redirect to a host the policy refuses', async () => {
    await pilot.perform({ kind: 'goto', target: `${originUrl}/redirected-image` })
    expect(internalHits).toBe(0)
  })

  it('does not load a subresource from a refused host', async () => {
    await pilot.perform({ kind: 'goto', target: `${originUrl}/` })
    expect(internalHits).toBe(0)
  })

  it('still serves the allowed preview', async () => {
    const seen = await pilot.perform({ kind: 'goto', target: `${originUrl}/` })
    expect(seen.detail).toContain(originUrl)
  })
})
