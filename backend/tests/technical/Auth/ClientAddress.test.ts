import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { clientAddressOf, isLoopbackPeer } from '../../../src/technical/Auth/ClientAddress.js'

function peerOf(address: string | undefined): Promise<Response> {
  const api = new Hono()
  api.get('/peer', (context) => context.json({ loopback: isLoopbackPeer(context) }))
  const env = address === undefined ? {} : { incoming: { socket: { remoteAddress: address } } }
  return Promise.resolve(api.request('/peer', {}, env))
}

describe('isLoopbackPeer', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('accepts %s', async (address) => {
    const body = await (await peerOf(address)).json()

    expect(body).toEqual({ loopback: true })
  })

  it('refuses a LAN address', async () => {
    const body = await (await peerOf('192.168.1.20')).json()

    expect(body).toEqual({ loopback: false })
  })

  it('refuses when the peer is unknown', async () => {
    const body = await (await peerOf(undefined)).json()

    expect(body).toEqual({ loopback: false })
  })
})

describe('clientAddressOf', () => {
  async function addressOf(
    trustProxy: boolean,
    headers: Record<string, string>,
    peer: string | null = '192.0.2.10',
  ): Promise<string> {
    const api = new Hono()
    api.get('/who', (context) => context.json({ address: clientAddressOf(context, trustProxy) }))
    const env = peer === null ? {} : { incoming: { socket: { remoteAddress: peer } } }
    const body = (await (await api.request('/who', { headers }, env)).json()) as { address: string }
    return body.address
  }

  it('ignores the forwarded header when the proxy is not trusted', async () => {
    expect(await addressOf(false, { 'x-forwarded-for': '203.0.113.5' })).toBe('192.0.2.10')
  })

  it('reads the last forwarded entry when the proxy is trusted', async () => {
    expect(await addressOf(true, { 'x-forwarded-for': '198.51.100.1, 203.0.113.5' })).toBe('203.0.113.5')
  })

  it('falls back to the peer when the proxy is trusted but sent nothing', async () => {
    expect(await addressOf(true, {})).toBe('192.0.2.10')
  })

  it('answers unknown when nothing identifies the peer', async () => {
    expect(await addressOf(false, {}, null)).toBe('unknown')
  })
})
