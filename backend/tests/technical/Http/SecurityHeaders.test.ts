import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import {
  contentSecurityPolicy,
  inlineScriptHashes,
  securityHeaders,
} from '../../../src/technical/Http/SecurityHeaders.js'

const INLINE = 'window.answer = 42'
const HTML = `<html><script>${INLINE}</script><script src="/config.js"></script><script type="module" src="/x.js"></script></html>`

describe('inlineScriptHashes', () => {
  it('hashes only the inline scripts', () => {
    const expected = `sha256-${createHash('sha256').update(INLINE).digest('base64')}`

    expect(inlineScriptHashes(HTML)).toEqual([expected])
  })
})

describe('contentSecurityPolicy', () => {
  it('allows scripts from self and the inline hashes, nothing from outside', () => {
    const policy = contentSecurityPolicy(HTML)

    expect(policy).toContain("script-src 'self' 'sha256-")
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).not.toContain('unsafe-eval')
    expect(policy).not.toMatch(/https?:/)
  })
})

describe('securityHeaders', () => {
  const app = new Hono()
  app.use('*', securityHeaders())
  app.get('/api/x', (context) => context.json({}))
  app.get('/page', (context) => context.text('ok'))

  it('sets the hardening headers and stops the api from being cached', async () => {
    const api = await app.request('/api/x')
    const page = await app.request('/page')

    expect(api.headers.get('x-content-type-options')).toBe('nosniff')
    expect(api.headers.get('x-frame-options')).toBe('DENY')
    expect(api.headers.get('referrer-policy')).toBe('no-referrer')
    expect(api.headers.get('cache-control')).toBe('no-store')
    expect(page.headers.get('cache-control')).toBeNull()
  })
})
