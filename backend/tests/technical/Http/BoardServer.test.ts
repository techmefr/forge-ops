import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  defaultBoardServerInput,
  startBoardServer,
  type BoardServer,
} from '../../../src/composition/BoardServer.js'
import { deriveHookToken } from '../../../src/technical/Auth/BoardToken.js'

let board: BoardServer | null = null
let claudeHome: string

afterEach(async () => {
  await board?.close()
  board = null
  rmSync(claudeHome, { recursive: true, force: true })
})

async function boot(): Promise<{ board: BoardServer; token: string }> {
  claudeHome = mkdtempSync(join(tmpdir(), 'forge-claude-home-'))
  const tokenPath = join(claudeHome, '.forge-token')
  const distDir = join(claudeHome, 'dist')
  mkdirSync(distDir)
  writeFileSync(join(distDir, 'index.html'), '<div id="board"></div>')
  const started = await startBoardServer({
    port: 0,
    dbPath: ':memory:',
    claudeHome,
    host: '127.0.0.1',
    worktreeRoot: join(claudeHome, 'worktrees'),
    checkoutRoots: [claudeHome],
    shotDir: join(claudeHome, 'shots'),
    headedPilot: false,
    metricsUrl: null,
    tokenPath,
    testsDir: join(claudeHome, 'tests'),
    mode: 'local',
    distDir,
  })
  return { board: started, token: readFileSync(tokenPath, 'utf-8').trim() }
}

describe('startBoardServer', () => {
  it('boots on a free port and answers the fleet route to a holder of the token', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/fleet`, {
      headers: { authorization: `Bearer ${booted.token}` },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ roster: null, jobs: [] })
  })

  it('refuses the very same route without the token', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/fleet`)

    expect(response.status).toBe(401)
  })

  it('refuses a dispatch coming from a web page', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/stories/1/dispatch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${booted.token}`,
        origin: 'https://site-malveillant.example',
      },
      body: JSON.stringify({ phase: 'spec' }),
    })

    expect(response.status).toBe(403)
  })

  it('binds the loopback interface by default, never every interface', () => {
    expect(defaultBoardServerInput().host).toBe('127.0.0.1')
  })

  it('answers on the loopback address it claims to bind', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/fleet`, {
      headers: { authorization: `Bearer ${booted.token}` },
    })

    expect(response.status).toBe(200)
  })

  it('refuses the hook intake when it carries no token', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/hooks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: 'inconnue', hook_event_name: 'PostToolUse' }),
    })

    expect(response.status).toBe(401)
  })

  it('takes the hook intake with the derived hook secret', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/hooks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forge-token': deriveHookToken(booted.token),
      },
      body: JSON.stringify({ session_id: 'inconnue', hook_event_name: 'PostToolUse' }),
    })

    expect(response.status).toBe(202)
  })

  it('refuses the hook intake when it presents the board token instead', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/hooks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forge-token': booted.token },
      body: JSON.stringify({ session_id: 'inconnue', hook_event_name: 'PostToolUse' }),
    })

    expect(response.status).toBe(401)
  })

  it('never lets the hook secret dispatch a session', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/stories/1/dispatch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${deriveHookToken(booted.token)}`,
      },
      body: JSON.stringify({ phase: 'spec' }),
    })

    expect(response.status).toBe(401)
  })

  it('serves the board page to anyone but hands an anonymous caller no token', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/`)

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBe(null)
    await expect(response.text()).resolves.not.toContain(booted.token)
  })

  it('refuses to open a browser session to a caller who cannot show the token', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'f'.repeat(64) }),
    })

    expect(response.status).toBe(401)
  })

  it('opens a browser session to a holder of the token, without echoing it back', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: booted.token }),
    })

    expect(response.status).toBe(201)
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('forge_token=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).not.toContain(booted.token)
  })

  it('lets that browser session through the api, the way the served page will', async () => {
    const booted = await boot()
    board = booted.board

    const opened = await fetch(`http://127.0.0.1:${board.port}/api/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: booted.token }),
    })
    const session = /forge_token=([0-9a-f]+)/.exec(opened.headers.get('set-cookie') ?? '')?.[1] ?? ''
    const response = await fetch(`http://127.0.0.1:${board.port}/api/fleet`, {
      headers: { cookie: `forge_token=${session}` },
    })

    expect(response.status).toBe(200)
  })

  it('shuts that browser session out again once it is closed', async () => {
    const booted = await boot()
    board = booted.board

    const opened = await fetch(`http://127.0.0.1:${board.port}/api/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: booted.token }),
    })
    const session = /forge_token=([0-9a-f]+)/.exec(opened.headers.get('set-cookie') ?? '')?.[1] ?? ''
    await fetch(`http://127.0.0.1:${board.port}/api/auth/session`, {
      method: 'DELETE',
      headers: { cookie: `forge_token=${session}` },
    })
    const response = await fetch(`http://127.0.0.1:${board.port}/api/fleet`, {
      headers: { cookie: `forge_token=${session}` },
    })

    expect(response.status).toBe(401)
  })

  it('keeps the api shut even though the page is open', async () => {
    const booted = await boot()
    board = booted.board

    await fetch(`http://127.0.0.1:${board.port}/`)
    const response = await fetch(`http://127.0.0.1:${board.port}/api/fleet`)

    expect(response.status).toBe(401)
  })

  it('refuses the master token offered as a cookie, so a stolen cookie is only a session', async () => {
    const booted = await boot()
    board = booted.board

    const response = await fetch(`http://127.0.0.1:${board.port}/api/fleet`, {
      headers: { cookie: `forge_token=${booted.token}` },
    })

    expect(response.status).toBe(401)
  })
})
