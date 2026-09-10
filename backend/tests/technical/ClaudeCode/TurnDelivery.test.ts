import { describe, expect, it } from 'vitest'
import { createLiveSessions } from '../../../src/technical/ClaudeCode/LiveSessions.js'
import { deliverTurn, userTurn } from '../../../src/technical/ClaudeCode/TurnDelivery.js'
import type { SdkUserTurn } from '../../../src/technical/ClaudeCode/TurnDelivery.js'

const TURN = { claudeSessionId: 'sess-1', reference: 'FORGE-1', message: 'reponds moi' }

describe('userTurn', () => {
  it('wraps the text in the shape the sdk expects from a streamed turn', () => {
    expect(userTurn('bonjour')).toEqual({
      type: 'user',
      message: { role: 'user', content: 'bonjour' },
      parent_tool_use_id: null,
    })
  })
})

describe('deliverTurn', () => {
  it('pushes into the living session', () => {
    const live = createLiveSessions<SdkUserTurn>()
    const started = live.start()
    started.adopt('sess-1')

    expect(deliverTurn(TURN, live)).toBe('live')
  })

  it('hands the living session the text of the turn', async () => {
    const live = createLiveSessions<SdkUserTurn>()
    const started = live.start()
    started.adopt('sess-1')

    deliverTurn(TURN, live)
    started.channel.close()
    const seen: SdkUserTurn[] = []
    for await (const message of started.channel) {
      seen.push(message)
    }

    expect(seen).toEqual([userTurn('reponds moi')])
  })

  it('reports a closed conversation when no channel is living', () => {
    const live = createLiveSessions<SdkUserTurn>()

    expect(deliverTurn(TURN, live)).toBe('closed')
  })

  it('reports a closed conversation when the channel died before the turn', () => {
    const live = createLiveSessions<SdkUserTurn>()
    const started = live.start()
    started.adopt('sess-1')
    started.channel.close()

    expect(deliverTurn(TURN, live)).toBe('closed')
  })

  it('never speaks to a neighbour session', async () => {
    const live = createLiveSessions<SdkUserTurn>()
    const other = live.start()
    other.adopt('sess-9')

    const route = deliverTurn(TURN, live)
    other.channel.close()
    const seen: SdkUserTurn[] = []
    for await (const message of other.channel) {
      seen.push(message)
    }

    expect([route, seen]).toEqual(['closed', []])
  })
})
