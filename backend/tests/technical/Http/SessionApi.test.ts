import { beforeEach, describe, expect, it } from 'vitest'
import type { Hono } from 'hono'
import { createBrowserSessions, type BrowserSessions } from '../../../src/technical/Auth/BrowserSession.js'
import { createSessionApi } from '../../../src/technical/Http/SessionApi.js'

const TOKEN = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)

let sessions: BrowserSessions
let api: Hono

beforeEach(() => {
  sessions = createBrowserSessions()
  api = createSessionApi({ token: TOKEN, sessions })
})

function exchange(body: unknown): Promise<Response> {
  return api.request('/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<Response>
}

describe('createSessionApi', () => {
  it('refuses a caller who brings no token at all', async () => {
    const response = await exchange({})

    expect(response.status).toBe(422)
    expect(sessions.count()).toBe(0)
  })

  it('refuses a caller who brings the wrong token', async () => {
    const response = await exchange({ token: OTHER })

    expect(response.status).toBe(401)
    expect(sessions.count()).toBe(0)
  })

  it('opens a browser session for a caller holding the board token', async () => {
    const response = await exchange({ token: TOKEN })

    expect(response.status).toBe(201)
    expect(sessions.count()).toBe(1)
  })

  it('hands the session back as an http-only cookie', async () => {
    const response = await exchange({ token: TOKEN })

    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('forge_token=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/')
  })

  it('never puts the board token in the cookie it hands out', async () => {
    const response = await exchange({ token: TOKEN })

    expect(response.headers.get('set-cookie') ?? '').not.toContain(TOKEN)
  })

  it('never echoes the board token in the body it answers', async () => {
    const response = await exchange({ token: TOKEN })

    await expect(response.text()).resolves.not.toContain(TOKEN)
  })

  it('mints a session the store then recognises', async () => {
    const response = await exchange({ token: TOKEN })

    const minted = /forge_token=([0-9a-f]+)/.exec(response.headers.get('set-cookie') ?? '')
    expect(minted).not.toBe(null)
    expect(sessions.isOpen(minted?.[1] ?? '')).toBe(true)
  })

  it('closes the session the caller presents on its way out', async () => {
    const opened = await exchange({ token: TOKEN })
    const minted = /forge_token=([0-9a-f]+)/.exec(opened.headers.get('set-cookie') ?? '')?.[1] ?? ''

    const response = await api.request('/api/auth/session', {
      method: 'DELETE',
      headers: { cookie: `forge_token=${minted}` },
    })

    expect(response.status).toBe(200)
    expect(sessions.isOpen(minted)).toBe(false)
  })
})

describe('createSessionApi, local autologin route', () => {
  it('opens a browser session without any token, the guard having already vetted the caller', async () => {
    const response = await api.request('/api/auth/session/local', { method: 'POST' })

    expect(response.status).toBe(201)
    expect(sessions.count()).toBe(1)
  })

  it('hands the session back as an http-only cookie, same as the token exchange', async () => {
    const response = await api.request('/api/auth/session/local', { method: 'POST' })

    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('forge_token=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
  })

  it('mints a session the store then recognises', async () => {
    const response = await api.request('/api/auth/session/local', { method: 'POST' })

    const minted = /forge_token=([0-9a-f]+)/.exec(response.headers.get('set-cookie') ?? '')
    expect(minted).not.toBe(null)
    expect(sessions.isOpen(minted?.[1] ?? '')).toBe(true)
  })
})
