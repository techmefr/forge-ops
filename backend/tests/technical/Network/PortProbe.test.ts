import { createServer } from 'node:net'
import { describe, expect, it } from 'vitest'
import { isPortBindable, LOOPBACK_HOST } from '../../../src/technical/Network/PortProbe.js'

function listenOnce(): Promise<{ port: number; release: () => Promise<void> }> {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen({ host: LOOPBACK_HOST, port: 0 }, () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        reject(new Error('the probe fixture did not obtain a numeric port'))
        return
      }
      resolve({
        port: address.port,
        release: () => new Promise<void>((done) => server.close(() => done())),
      })
    })
  })
}

describe('isPortBindable', () => {
  it('reports a port held by another process as unavailable', async () => {
    const held = await listenOnce()
    try {
      expect(isPortBindable(held.port)).toBe(false)
    } finally {
      await held.release()
    }
  })

  it('reports a port nobody holds as available', async () => {
    const held = await listenOnce()
    const port = held.port
    await held.release()

    expect(isPortBindable(port)).toBe(true)
  })
})
