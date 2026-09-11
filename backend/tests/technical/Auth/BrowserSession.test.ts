import { describe, expect, it } from 'vitest'
import { createBrowserSessions } from '../../../src/technical/Auth/BrowserSession.js'

describe('createBrowserSessions', () => {
  it('opens a session whose token is unguessable and never the one it was minted from', () => {
    const sessions = createBrowserSessions()

    const first = sessions.open()
    const second = sessions.open()

    expect(first.token).toMatch(/^[0-9a-f]{64}$/)
    expect(first.token).not.toBe(second.token)
  })

  it('recognises a session it opened', () => {
    const sessions = createBrowserSessions()

    const opened = sessions.open()

    expect(sessions.isOpen(opened.token)).toBe(true)
  })

  it('refuses a token it never minted', () => {
    const sessions = createBrowserSessions()

    expect(sessions.isOpen('f'.repeat(64))).toBe(false)
  })

  it('refuses a session once its lifetime has run out', () => {
    let now = 1_000
    const sessions = createBrowserSessions({ lifetimeMs: 500, clock: () => now })

    const opened = sessions.open()
    now = 1_501

    expect(sessions.isOpen(opened.token)).toBe(false)
  })

  it('refuses a session that was closed', () => {
    const sessions = createBrowserSessions()

    const opened = sessions.open()
    sessions.close(opened.token)

    expect(sessions.isOpen(opened.token)).toBe(false)
  })

  it('stays bounded by dropping the oldest session once the cap is reached', () => {
    const sessions = createBrowserSessions({ cap: 2 })

    const first = sessions.open()
    sessions.open()
    const third = sessions.open()

    expect(sessions.count()).toBe(2)
    expect(sessions.isOpen(first.token)).toBe(false)
    expect(sessions.isOpen(third.token)).toBe(true)
  })

  it('reclaims expired sessions instead of counting them against the cap', () => {
    let now = 1_000
    const sessions = createBrowserSessions({ lifetimeMs: 500, cap: 4, clock: () => now })

    sessions.open()
    sessions.open()
    now = 2_000
    sessions.open()

    expect(sessions.count()).toBe(1)
  })

  it('dates the expiry from the clock it was given', () => {
    const sessions = createBrowserSessions({ lifetimeMs: 500, clock: () => 1_000 })

    expect(sessions.open().expiresAt).toBe(1_500)
  })
})
