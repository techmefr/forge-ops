import { describe, expect, it } from 'vitest'
import { sessionContextOf } from '../../../src/domain/Agent/SessionContext.js'
import type { AgentSession } from '../../../src/domain/Agent/AgentSession.js'

const BASE: AgentSession = {
  id: 1,
  storyId: 1,
  claudeSessionId: 'sess-1',
  phase: 'code',
  agentName: 'trinity',
  lifecycle: 'working',
  claudeCodeVersion: '2.1.218',
  costUsd: 0,
  contextTokens: null,
  contextWindow: null,
}

describe('sessionContextOf', () => {
  it('returns null when there is no session', () => {
    expect(sessionContextOf(null)).toBeNull()
  })

  it('returns null when the session never reported any context tokens', () => {
    expect(sessionContextOf(BASE)).toBeNull()
  })

  it('returns null once the session has finished, even with a known reading', () => {
    expect(
      sessionContextOf({ ...BASE, lifecycle: 'finished', contextTokens: 4000, contextWindow: 200000 }),
    ).toBeNull()
  })

  it('exposes the tokens and window for a running session', () => {
    expect(sessionContextOf({ ...BASE, contextTokens: 4000, contextWindow: 200000 })).toEqual({
      tokens: 4000,
      window: 200000,
    })
  })

  it('exposes the tokens alone when the window is not knowable', () => {
    expect(sessionContextOf({ ...BASE, contextTokens: 4000, contextWindow: null })).toEqual({
      tokens: 4000,
      window: null,
    })
  })
})
