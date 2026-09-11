import { describe, expect, it } from 'vitest'
import { recordHeartbeatFromEvent } from '../../../src/technical/ClaudeCode/HeartbeatRecorder.js'
import type { AgentLifecycle } from '../../../src/domain/Agent/AgentSession.js'

function repositoryOf(lifecycle: AgentLifecycle) {
  const beats: string[] = []
  const sessions = {
    findByClaudeSessionId: (claudeSessionId: string) =>
      claudeSessionId === 'sess-1' ? { claudeSessionId, lifecycle } : null,
    recordHeartbeat: (claudeSessionId: string) => {
      beats.push(claudeSessionId)
    },
  }
  return { sessions, beats }
}

function record(payload: Record<string, unknown>, lifecycle: AgentLifecycle = 'working') {
  const { sessions, beats } = repositoryOf(lifecycle)
  const beaten = recordHeartbeatFromEvent(sessions as never, { name: 'session.assistant', payload })
  return { beaten, beats }
}

describe('recordHeartbeatFromEvent', () => {
  it('takes any word from a running session as a sign of life', () => {
    expect(record({ claudeSessionId: 'sess-1' })).toEqual({ beaten: true, beats: ['sess-1'] })
  })

  it('takes a word from a session awaiting a human as a sign of life', () => {
    expect(record({ claudeSessionId: 'sess-1' }, 'awaiting_human')).toEqual({
      beaten: true,
      beats: ['sess-1'],
    })
  })

  it('ignores an event that names no session', () => {
    expect(record({})).toEqual({ beaten: false, beats: [] })
  })

  it('ignores an event naming a session nobody registered', () => {
    expect(record({ claudeSessionId: 'sess-404' })).toEqual({ beaten: false, beats: [] })
  })

  it('ignores a session that has already ended', () => {
    expect(record({ claudeSessionId: 'sess-1' }, 'finished')).toEqual({ beaten: false, beats: [] })
  })
})
