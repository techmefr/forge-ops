import { describe, expect, it } from 'vitest'
import { createEventBus, type BoardEvent } from '../../../src/technical/Http/EventBus.js'

describe('createEventBus', () => {
  it('delivers a published event to its subscriber', () => {
    const bus = createEventBus()
    const seen: BoardEvent[] = []
    bus.subscribe((event) => seen.push(event))

    bus.publish({ name: 'session.dispatched', payload: { reference: 'FORGE-1' } })

    expect(seen).toEqual([{ name: 'session.dispatched', payload: { reference: 'FORGE-1' } }])
  })

  it('delivers to every subscriber', () => {
    const bus = createEventBus()
    let first = 0
    let second = 0
    bus.subscribe(() => (first += 1))
    bus.subscribe(() => (second += 1))

    bus.publish({ name: 'story.moved', payload: {} })

    expect([first, second]).toEqual([1, 1])
  })

  it('stops delivering once unsubscribed', () => {
    const bus = createEventBus()
    const seen: BoardEvent[] = []
    const unsubscribe = bus.subscribe((event) => seen.push(event))

    unsubscribe()
    bus.publish({ name: 'story.moved', payload: {} })

    expect(seen).toEqual([])
  })

  it('counts its live subscribers', () => {
    const bus = createEventBus()
    const unsubscribe = bus.subscribe(() => undefined)
    bus.subscribe(() => undefined)

    unsubscribe()

    expect(bus.countSubscribers()).toBe(1)
  })

  it('keeps serving the other subscribers when one of them throws', () => {
    const bus = createEventBus()
    let reached = 0
    bus.subscribe(() => {
      throw new Error('client parti')
    })
    bus.subscribe(() => (reached += 1))

    bus.publish({ name: 'story.moved', payload: {} })

    expect(reached).toBe(1)
  })
})
