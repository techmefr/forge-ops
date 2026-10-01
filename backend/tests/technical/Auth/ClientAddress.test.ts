import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { isLoopbackPeer } from '../../../src/technical/Auth/ClientAddress.js'

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
