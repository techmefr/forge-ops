import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { cookieSecure } from '../../../src/technical/Auth/SecureCookie.js'

async function secureFor(url: string, headers: Record<string, string> = {}): Promise<boolean> {
  const api = new Hono()
  api.get('/', (context) => context.json({ secure: cookieSecure(context) }))
  const response = await api.request(url, { headers })
  return ((await response.json()) as { secure: boolean }).secure
}

describe('cookieSecure', () => {
  it('is secure on an https url', async () => {
    await expect(secureFor('https://forge.test/')).resolves.toBe(true)
  })

  it('is not secure on a plain http url', async () => {
    await expect(secureFor('http://forge.test/')).resolves.toBe(false)
  })

  it('is secure behind a proxy that forwards https', async () => {
    await expect(secureFor('http://forge.test/', { 'x-forwarded-proto': 'https' })).resolves.toBe(true)
  })

  it('reads the first hop of a forwarded chain', async () => {
    await expect(secureFor('http://forge.test/', { 'x-forwarded-proto': 'https, http' })).resolves.toBe(true)
  })

  it('stays insecure when the first forwarded hop is http', async () => {
    await expect(secureFor('http://forge.test/', { 'x-forwarded-proto': 'http, https' })).resolves.toBe(false)
  })
})
