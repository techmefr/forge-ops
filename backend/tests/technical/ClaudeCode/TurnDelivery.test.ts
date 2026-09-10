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
  it('pushes into the living session rather than starting another query', () => {
    const live = createLiveSessions<SdkUserTurn>()
    const started = live.start()
    started.adopt('sess-1')
    const resumed: string[] = []

    const route = deliverTurn(TURN, live, (turn) => resumed.push(turn.message))

    expect([route, resumed]).toEqual(['live', []])
  })

  it('hands the living session the text of the turn', async () => {
    const live = createLiveSessions<SdkUserTurn>()
    const started = live.start()
    started.adopt('sess-1')

    deliverTurn(TURN, live, () => {})
    started.channel.close()
    const seen: SdkUserTurn[] = []
    for await (const message of started.channel) {
      seen.push(message)
    }

    expect(seen).toEqual([userTurn('reponds moi')])
  })

  it('resumes a dormant session that has no living channel', () => {
    const live = createLiveSessions<SdkUserTurn>()
    const resumed: string[] = []

    const route = deliverTurn(TURN, live, (turn) => resumed.push(turn.message))

    expect([route, resumed]).toEqual(['resumed', ['reponds moi']])
  })

  it('resumes when the living channel died before the turn arrived', () => {
    const live = createLiveSessions<SdkUserTurn>()
    const started = live.start()
    started.adopt('sess-1')
    started.channel.close()
    const resumed: string[] = []

    const route = deliverTurn(TURN, live, (turn) => resumed.push(turn.message))

    expect([route, resumed]).toEqual(['resumed', ['reponds moi']])
  })

  it('speaks to the session named by the turn, not to a neighbour', () => {
    const live = createLiveSessions<SdkUserTurn>()
    const other = live.start()
    other.adopt('sess-9')
    const resumed: string[] = []

    const route = deliverTurn(TURN, live, (turn) => resumed.push(turn.message))

    expect([route, resumed]).toEqual(['resumed', ['reponds moi']])
  })
})
