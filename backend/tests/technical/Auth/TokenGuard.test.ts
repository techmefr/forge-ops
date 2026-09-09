import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { createTokenGuard } from '../../../src/technical/Auth/TokenGuard.js'

const TOKEN = 'a'.repeat(64)
const OTHER = 'b'.repeat(64)

let api: Hono

beforeEach(() => {
  api = new Hono()
  api.use(
    '/api/*',
    createTokenGuard({
      token: TOKEN,
      allowedOrigins: ['http://localhost:8832'],
      openPaths: ['/api/hooks'],
    }),
  )
  api.post('/api/hooks', (context) => context.json({ recorded: true }, 202))
  api.get('/api/things', (context) => context.json({ ok: true }))
  api.post('/api/things', (context) => context.json({ written: true }, 201))
  api.get('/api/events', (context) => context.text('flux'))
  api.get('/health', (context) => context.text('vivant'))
})

describe('le jeton', () => {
  it('refuses a request that carries none', async () => {
    const response = await api.request('/api/things')

    expect(response.status).toBe(401)
  })

  it('refuses a wrong token', async () => {
    const response = await api.request('/api/things', { headers: { authorization: `Bearer ${OTHER}` } })

    expect(response.status).toBe(401)
  })

  it('refuses a token of the right length but wrong content', async () => {
    const response = await api.request('/api/things', {
      headers: { authorization: `Bearer ${'a'.repeat(63)}c` },
    })

    expect(response.status).toBe(401)
  })

  it('accepts the token as a bearer', async () => {
    const response = await api.request('/api/things', { headers: { authorization: `Bearer ${TOKEN}` } })

    expect(response.status).toBe(200)
  })

  it('accepts the token in its own header', async () => {
    const response = await api.request('/api/things', { headers: { 'x-forge-token': TOKEN } })

    expect(response.status).toBe(200)
  })

  it('guards the mutating routes too', async () => {
    const response = await api.request('/api/things', { method: 'POST' })

    expect(response.status).toBe(401)
  })

  it('leaves what is not under /api alone', async () => {
    const response = await api.request('/health')

    expect(response.status).toBe(200)
  })
})

describe("l'origine du navigateur", () => {
  it('refuses a foreign origin even with a valid token', async () => {
    const response = await api.request('/api/things', {
      headers: { authorization: `Bearer ${TOKEN}`, origin: 'https://site-malveillant.example' },
    })

    expect(response.status).toBe(403)
  })

  it('accepts an allowed origin', async () => {
    const response = await api.request('/api/things', {
      headers: { authorization: `Bearer ${TOKEN}`, origin: 'http://localhost:8832' },
    })

    expect(response.status).toBe(200)
  })

  it('accepts a request that carries no origin at all', async () => {
    const response = await api.request('/api/things', { headers: { authorization: `Bearer ${TOKEN}` } })

    expect(response.status).toBe(200)
  })

  it('refuses a foreign origin before even looking at the token', async () => {
    const response = await api.request('/api/things', {
      headers: { origin: 'https://site-malveillant.example' },
    })

    expect(response.status).toBe(403)
  })
})

describe("l'entree des hooks", () => {
  it('accepts the hook intake without a token, since the hook carries none', async () => {
    const response = await api.request('/api/hooks', { method: 'POST' })

    expect(response.status).toBe(202)
  })

  it('still refuses the hook intake when a browser page tries it', async () => {
    const response = await api.request('/api/hooks', {
      method: 'POST',
      headers: { origin: 'https://site-malveillant.example' },
    })

    expect(response.status).toBe(403)
  })

  it('leaves the other routes closed even so', async () => {
    const response = await api.request('/api/things', { method: 'POST' })

    expect(response.status).toBe(401)
  })
})

describe('le flux SSE', () => {
  it('accepts the token as a query parameter, since EventSource sets no header', async () => {
    const response = await api.request(`/api/events?token=${TOKEN}`)

    expect(response.status).toBe(200)
  })

  it('refuses a wrong token in the query parameter', async () => {
    const response = await api.request(`/api/events?token=${OTHER}`)

    expect(response.status).toBe(401)
  })

  it('does not accept a query parameter anywhere else', async () => {
    const response = await api.request(`/api/things?token=${TOKEN}`)

    expect(response.status).toBe(401)
  })
})
