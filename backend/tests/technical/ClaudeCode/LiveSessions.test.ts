import { describe, expect, it } from 'vitest'
import {
  createLiveSessions,
  LiveSessionCapReachedError,
  SessionAlreadyLiveError,
} from '../../../src/technical/ClaudeCode/LiveSessions.js'

describe('createLiveSessions', () => {
  it('does not expose a session that has no identifier yet', () => {
    const live = createLiveSessions<string>()
    live.start()

    expect(live.find('sess-1')).toBe(null)
  })

  it('exposes a session once it is adopted under its identifier', () => {
    const live = createLiveSessions<string>()
    const started = live.start()

    started.adopt('sess-1')

    expect(live.find('sess-1')).toBe(started.channel)
  })

  it('knows nothing of an unknown identifier', () => {
    const live = createLiveSessions<string>()

    expect(live.find('jamais-vu')).toBe(null)
  })

  it('closes the channel it is asked to forget', () => {
    const live = createLiveSessions<string>()
    const started = live.start()
    started.adopt('sess-1')

    expect(live.close('sess-1')).toBe(true)
    expect(started.channel.open).toBe(false)
    expect(live.find('sess-1')).toBe(null)
  })

  it('reports that an unknown identifier was not closed', () => {
    const live = createLiveSessions<string>()

    expect(live.close('jamais-vu')).toBe(false)
  })

  it('drops a channel that died on its own', () => {
    const live = createLiveSessions<string>()
    const started = live.start()
    started.adopt('sess-1')

    started.channel.close()

    expect(live.find('sess-1')).toBe(null)
  })

  it('closes every adopted session at once', () => {
    const live = createLiveSessions<string>()
    const first = live.start()
    const second = live.start()
    first.adopt('sess-1')
    second.adopt('sess-2')

    live.closeAll()

    expect([first.channel.open, second.channel.open, live.find('sess-1')]).toEqual([false, false, null])
  })

  it('forgets a channel that died on its own, without waiting for a lookup', () => {
    const live = createLiveSessions<string>()
    const started = live.start()
    started.adopt('sess-1')

    started.channel.close()

    expect(live.count()).toBe(0)
  })

  it('forgets a channel closed through the map itself', () => {
    const live = createLiveSessions<string>()
    const started = live.start()
    started.adopt('sess-1')

    live.close('sess-1')

    expect(live.count()).toBe(0)
  })

  it('refuses to adopt an identifier another channel already answers for', () => {
    const live = createLiveSessions<string>()
    const held = live.start()
    const intruder = live.start()
    held.adopt('sess-1')

    expect(() => intruder.adopt('sess-1')).toThrow(SessionAlreadyLiveError)
    expect(live.find('sess-1')).toBe(held.channel)
  })

  it('lets an identifier be adopted again once its channel is gone', () => {
    const live = createLiveSessions<string>()
    const held = live.start()
    const next = live.start()
    held.adopt('sess-1')
    held.channel.close()

    next.adopt('sess-1')

    expect(live.find('sess-1')).toBe(next.channel)
  })

  it('refuses to hold more sessions than its cap', () => {
    const live = createLiveSessions<string>({ cap: 2 })
    live.start().adopt('sess-1')
    live.start().adopt('sess-2')

    expect(() => live.start().adopt('sess-3')).toThrow(LiveSessionCapReachedError)
  })
})
