import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import {
  AUTH_BODY_LIMIT_BYTES,
  GLOBAL_BODY_LIMIT_BYTES,
  requestBodyLimit,
} from '../../../src/technical/Http/RequestBodyLimit.js'

function build(): { api: Hono; parsed: () => number } {
  let parsedCount = 0
  const api = new Hono()
  api.use('/api/*', requestBodyLimit())
  api.post('/api/*', async (context) => {
    parsedCount += 1
    await context.req.json().catch(() => null)
    return context.json({ ok: true }, 201)
  })
  return { api, parsed: () => parsedCount }
}

function jsonOfSize(bytes: number): string {
  return JSON.stringify({ filler: 'x'.repeat(bytes) })
}

describe('requestBodyLimit', () => {
  it('lets a small body through on an ordinary route', async () => {
    const { api } = build()

    const response = await api.request('/api/epics', { method: 'POST', body: jsonOfSize(100) })

    expect(response.status).toBe(201)
  })

  it('refuses a body above the global limit with a 413, without reaching the handler', async () => {
    const { api, parsed } = build()

    const response = await api.request('/api/epics', {
      method: 'POST',
      body: jsonOfSize(GLOBAL_BODY_LIMIT_BYTES + 1),
    })

    expect(response.status).toBe(413)
    expect(parsed()).toBe(0)
  })

  it('lets a body just above the auth limit through on an ordinary route', async () => {
    const { api } = build()

    const response = await api.request('/api/epics', {
      method: 'POST',
      body: jsonOfSize(AUTH_BODY_LIMIT_BYTES + 1),
    })

    expect(response.status).toBe(201)
  })

  it('refuses a body above the auth limit on an unauthenticated auth route, without reaching the handler', async () => {
    const { api, parsed } = build()

    const response = await api.request('/api/auth/login', {
      method: 'POST',
      body: jsonOfSize(AUTH_BODY_LIMIT_BYTES + 1),
    })

    expect(response.status).toBe(413)
    expect(parsed()).toBe(0)
  })

  it('refuses an oversized body that declares no length', async () => {
    const { api, parsed } = build()
    const chunk = new TextEncoder().encode('x'.repeat(64 * 1024))
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk)
      },
    })

    const response = await api.request('/api/auth/login', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit)

    expect(response.status).toBe(413)
    expect(parsed()).toBeLessThanOrEqual(1)
  })

  it('answers with a JSON error', async () => {
    const { api } = build()

    const response = await api.request('/api/auth/login', {
      method: 'POST',
      body: jsonOfSize(AUTH_BODY_LIMIT_BYTES + 1),
    })

    expect(await response.json()).toEqual({ error: 'PayloadTooLarge' })
  })
})
