import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startBoardServer, type BoardServer } from '../../src/composition/BoardServer.js'

const PASSWORD = 'a long enough password'

let board: BoardServer
let home: string
let base: string

type Body = {
  id: number
  error?: string
  column: { key: string }
  columns: { label: string }[]
  maySettle: boolean
  session?: unknown
}

type Answer = { status: number; body: Body }

async function call(
  method: string,
  path: string,
  credentials: { identity?: string },
  body?: unknown,
): Promise<Answer> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  headers['x-forge-identity'] = credentials.identity ?? rootIdentity
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const raw = await response.text()
  return { status: response.status, body: raw === '' ? null : JSON.parse(raw) }
}

async function login(name: string, password: string): Promise<{ status: number; identity: string }> {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login: name, password }),
  })
  const cookie = response.headers.get('set-cookie') ?? ''
  const match = /forge_identity=([^;]+)/.exec(cookie)
  return { status: response.status, identity: match?.[1] ?? '' }
}

const LOCAL = {}

beforeAll(async () => {
  process.env.FORGE_SUPER_ADMIN_LOGIN = 'root'
  process.env.FORGE_SUPER_ADMIN_PASSWORD = PASSWORD
  home = mkdtempSync(join(tmpdir(), 'forge-e2e-'))
  const distDir = join(home, 'dist')
  mkdirSync(distDir)
  writeFileSync(join(distDir, 'index.html'), '<div id="board"></div>')
  const tokenPath = join(home, '.forge-token')
  board = await startBoardServer({
    port: 0,
    dbPath: ':memory:',
    claudeHome: home,
    host: '127.0.0.1',
    publicOrigin: null,
    worktreeRoot: join(home, 'worktrees'),
    checkoutRoots: [home],
    shotDir: join(home, 'shots'),
    headedPilot: false,
    metricsUrl: null,
    tokenPath,
    testsDir: join(home, 'tests'),
    mode: 'hub',
    environmentMode: 'real',
    distDir,
  })
  delete process.env.FORGE_SUPER_ADMIN_LOGIN
  delete process.env.FORGE_SUPER_ADMIN_PASSWORD
  base = `http://127.0.0.1:${board.port}`
})

afterAll(async () => {
  await board.close()
  rmSync(home, { recursive: true, force: true })
})

let rootIdentity = ''
let anaIdentity = ''
let bobIdentity = ''
let projectId = 0
let subjectId = 0
let stepKey = ''

const COLUMN = {
  label: 'Build',
  colour: 'acc',
  provider: 'human',
  model: '',
  effort: '',
  agentName: '',
  command: '',
  preprompt: '',
  autoStart: false,
}

describe('super admin bootstrap', () => {
  it('lets the configured super admin in and refuses a wrong password', async () => {
    expect((await login('root', 'wrong password here')).status).toBe(401)
    const opened = await login('root', PASSWORD)
    expect(opened.status).toBe(200)
    expect(opened.identity).not.toBe('')
    rootIdentity = opened.identity
    const self = await call('GET', '/api/board/self', { identity: rootIdentity })
    expect(self.body).toEqual({ login: 'root', superAdmin: true })
  })

  it('lets the super admin enrol members, and refuses a member doing it', async () => {
    for (const name of ['ana', 'bob']) {
      const created = await call('POST', '/api/board-users', { identity: rootIdentity }, {
        login: name,
        displayName: name,
        password: PASSWORD,
        role: 'architect',
      })
      expect(created.status).toBe(201)
      expect(JSON.stringify(created.body)).not.toContain('hash')
    }
    anaIdentity = (await login('ana', PASSWORD)).identity
    bobIdentity = (await login('bob', PASSWORD)).identity
    const refused = await call('POST', '/api/board-users', { identity: bobIdentity }, {
      login: 'eve',
      displayName: 'eve',
      password: PASSWORD,
      role: 'architect',
    })
    expect(refused.status).toBe(403)
  })
})

describe('project, subject, event and risk', () => {
  it('walks the whole chain', async () => {
    const project = await call('POST', '/api/projects', LOCAL, { name: 'Alpha', colour: '#112233', repository: '' })
    expect(project.status).toBe(201)
    projectId = project.body.id

    const subject = await call('POST', '/api/epics', LOCAL, { projectId, title: 'Ship the thing' })
    expect(subject.status).toBe(201)
    subjectId = subject.body.id

    const event = await call('POST', '/api/events', LOCAL, {
      type: 'demo',
      date: '2026-10-01',
      title: 'Demo day',
      projectId,
      epicId: subjectId,
    })
    expect(event.status).toBe(201)

    const risk = await call('POST', `/api/projects/${projectId}/risks`, LOCAL, {
      text: 'The vendor may slip',
      level: 'high',
      epicId: subjectId,
    })
    expect(risk.status).toBe(201)

    const followUp = await call('GET', `/api/projects/${projectId}/follow-up`, LOCAL)
    expect(followUp.status).toBe(200)
    expect(JSON.stringify(followUp.body)).toContain('The vendor may slip')
    const events = await call('GET', `/api/projects/${projectId}/events`, LOCAL)
    expect(JSON.stringify(events.body)).toContain('Demo day')
  })
})

describe('taking and releasing a subject', () => {
  it('lets one person take it, refuses another, then frees it on release', async () => {
    expect((await call('POST', `/api/epics/${subjectId}/claim`, { identity: anaIdentity })).status).toBe(200)
    expect((await call('POST', `/api/epics/${subjectId}/claim`, { identity: bobIdentity })).status).toBe(409)
    expect((await call('DELETE', `/api/epics/${subjectId}/claim`, { identity: bobIdentity })).status).toBe(409)
    expect((await call('DELETE', `/api/epics/${subjectId}/claim`, { identity: anaIdentity })).status).toBe(200)
    expect((await call('POST', `/api/epics/${subjectId}/claim`, { identity: bobIdentity })).status).toBe(200)
    expect((await call('DELETE', `/api/epics/${subjectId}/claim`, { identity: bobIdentity })).status).toBe(200)
  })
})

describe('editing the workflow', () => {
  it('lets the project admin add a step and refuses a plain member with 403', async () => {
    const users = await call('GET', '/api/board-users', { identity: rootIdentity })
    const ana = (users.body as unknown as { id: number; login: string }[]).find((user) => user.login === 'ana')
    const settled = await call('PUT', `/api/projects/${projectId}`, { identity: rootIdentity }, { adminId: ana?.id })
    expect(settled.status).toBe(200)

    const refused = await call('POST', `/api/projects/${projectId}/workflow-columns`, { identity: bobIdentity }, COLUMN)
    expect(refused.status).toBe(403)
    const added = await call('POST', `/api/projects/${projectId}/workflow-columns`, { identity: anaIdentity }, COLUMN)
    expect(added.status).toBe(201)
    stepKey = added.body.column.key
    const listed = await call('GET', `/api/projects/${projectId}/workflow-columns`, { identity: bobIdentity })
    expect(listed.body.maySettle).toBe(false)
    expect(listed.body.columns.map((column: { label: string }) => column.label)).toContain('Build')
  })
})

describe('the pipeline', () => {
  it('moves a card into a human step without starting an agent, and refuses to close it early', async () => {
    const story = await call('POST', '/api/forge-cards/backlog', LOCAL, { subjectId, title: 'A thin story' })
    expect(story.status).toBe(201)
    const cards = await call('GET', `/api/forge-cards?project=${projectId}`, LOCAL)
    const card = (cards.body as unknown as { id: number; title: string }[]).find((entry) => entry.title === 'A thin story')
    expect(card).toBeDefined()

    const moved = await call('POST', `/api/forge-cards/${card?.id}/move`, LOCAL, { stepKey })
    expect(moved.status, JSON.stringify(moved.body)).toBe(200)
    expect(moved.body.session ?? null).toBeNull()

    const closed = await call('POST', `/api/forge-cards/${card?.id}/done`, LOCAL, {})
    expect(closed.status).toBe(409)
    expect(closed.body.error).toBeDefined()
  })
})
