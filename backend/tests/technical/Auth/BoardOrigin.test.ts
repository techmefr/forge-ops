import { describe, expect, it } from 'vitest'
import { boardOrigins } from '../../../src/technical/Auth/BoardOrigin.js'

describe('boardOrigins', () => {
  it('allows the address the board is bound to', () => {
    expect(boardOrigins('127.0.0.1', 8830)).toContain('http://127.0.0.1:8830')
  })

  it('allows the same port under localhost, which is what a browser sends', () => {
    expect(boardOrigins('127.0.0.1', 8830)).toContain('http://localhost:8830')
  })

  it('allows the loopback address when bound to localhost', () => {
    expect(boardOrigins('localhost', 8830)).toContain('http://127.0.0.1:8830')
  })

  it('allows the dev server, which proxies the api', () => {
    expect(boardOrigins('127.0.0.1', 8830)).toContain('http://localhost:8832')
  })

  it('does not allow another port on the same host', () => {
    expect(boardOrigins('127.0.0.1', 8830)).not.toContain('http://127.0.0.1:9999')
  })

  it('does not allow an outside host', () => {
    expect(boardOrigins('127.0.0.1', 8830).some((origin) => origin.includes('example'))).toBe(false)
  })

  it('keeps a non loopback bind address as it is, without inventing localhost', () => {
    expect(boardOrigins('192.168.1.20', 8830)).toContain('http://192.168.1.20:8830')
  })

  it('lists each origin once', () => {
    const origins = boardOrigins('localhost', 8832)

    expect(new Set(origins).size).toBe(origins.length)
  })
})
