import { beforeEach, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { createTokenGuard } from '../../../src/technical/Auth/TokenGuard.js'

const BOARD_TOKEN = 'b'.repeat(64)
const HOOK_TOKEN = 'h'.repeat(64)

let app: Hono<{ Variables: { login: string } }>

beforeEach(() => {
  app = new Hono()
  app.use(
    '/api/*',
    createTokenGuard({
      token: BOARD_TOKEN,
      hookToken: HOOK_TOKEN,
      allowedOrigins: ['http://127.0.0.1:8830'],
      requireIdentity: true,
      readIdentity: (sessionToken) => (sessionToken === 'bonne-session' ? { login: 'gaetan' } : null),
    }),
  )
  app.get('/api/fleet', (context) => context.json({ ok: true, login: context.get('login') }))
  app.post('/api/auth/login', (context) => context.json({ ok: true }))
  app.post('/api/hooks', (context) => context.json({ ok: true }))
})

describe('la garde en mode hub', () => {
  it('laisse passer une session valide portee par le cookie', async () => {
    const response = await app.request('/api/fleet', { headers: { cookie: 'forge_identity=bonne-session' } })

    expect(response.status).toBe(200)
  })

  it('laisse passer une session valide portee par l en-tete', async () => {
    const response = await app.request('/api/fleet', { headers: { 'x-forge-identity': 'bonne-session' } })

    expect(response.status).toBe(200)
  })

  it('nomme la personne connectee pour la suite du traitement', async () => {
    const response = await app.request('/api/fleet', { headers: { 'x-forge-identity': 'bonne-session' } })

    await expect(response.json()).resolves.toMatchObject({ login: 'gaetan' })
  })

  it('refuse une requete sans session', async () => {
    const response = await app.request('/api/fleet')

    expect(response.status).toBe(401)
  })

  it('refuse une session inconnue', async () => {
    const response = await app.request('/api/fleet', { headers: { 'x-forge-identity': 'nawak' } })

    expect(response.status).toBe(401)
  })

  it('refuse le jeton du board, qui n est plus une identite en mode hub', async () => {
    const response = await app.request('/api/fleet', { headers: { authorization: `Bearer ${BOARD_TOKEN}` } })

    expect(response.status).toBe(401)
  })

  it('laisse la porte de connexion ouverte, sinon personne ne pourrait entrer', async () => {
    const response = await app.request('/api/auth/login', { method: 'POST' })

    expect(response.status).toBe(200)
  })

  it('garde le controle d origine avant tout, meme sur la porte de connexion', async () => {
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://site-malveillant.example' },
    })

    expect(response.status).toBe(403)
  })

  it('laisse l entree des hooks sur son propre secret, sans identite', async () => {
    const response = await app.request('/api/hooks', {
      method: 'POST',
      headers: { authorization: `Bearer ${HOOK_TOKEN}` },
    })

    expect(response.status).toBe(200)
  })

  it('ne laisse pas une session valide servir de secret de hook', async () => {
    const response = await app.request('/api/hooks', {
      method: 'POST',
      headers: { authorization: 'Bearer bonne-session' },
    })

    expect(response.status).toBe(401)
  })
})
