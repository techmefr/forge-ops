import { describe, expect, it } from 'vitest'
import { recordLifecycleFromEvent } from '../../../src/technical/ClaudeCode/LifecycleRecorder.js'
import type { AgentLifecycle } from '../../../src/domain/Agent/AgentSession.js'
import type { SessionExit } from '../../../src/domain/Agent/SessionOutcome.js'

type Move = { lifecycle: AgentLifecycle } | { closed: SessionExit }

function repositoryOf(lifecycle: AgentLifecycle) {
  const moves: Move[] = []
  const sessions = {
    findByClaudeSessionId: (claudeSessionId: string) =>
      claudeSessionId === 'sess-1' ? { claudeSessionId, lifecycle } : null,
    updateLifecycle: (_id: string, next: AgentLifecycle) => {
      moves.push({ lifecycle: next })
      return { lifecycle: next }
    },
    closeSession: (_id: string, exit: SessionExit) => {
      moves.push({ closed: exit })
      return { lifecycle: 'finished' as AgentLifecycle }
    },
  }
  return { sessions, moves }
}

function record(name: string, payload: Record<string, unknown>, lifecycle: AgentLifecycle = 'starting') {
  const { sessions, moves } = repositoryOf(lifecycle)
  const changed = recordLifecycleFromEvent(sessions as never, { name, payload })
  return { changed, moves }
}

describe('recordLifecycleFromEvent', () => {
  it('puts a starting session to work as soon as it speaks', () => {
    expect(record('session.assistant', { claudeSessionId: 'sess-1' })).toEqual({
      changed: true,
      moves: [{ lifecycle: 'working' }],
    })
  })

  it('leaves a session that is already working alone', () => {
    expect(record('session.assistant', { claudeSessionId: 'sess-1' }, 'working')).toEqual({
      changed: false,
      moves: [],
    })
  })

  it('hands the turn back to the human when the sdk closes it', () => {
    expect(record('session.result', { claudeSessionId: 'sess-1' }, 'working')).toEqual({
      changed: true,
      moves: [{ lifecycle: 'awaiting_human' }],
    })
  })

  it('closes a session whose turn ended on an error', () => {
    expect(record('session.result', { claudeSessionId: 'sess-1', isError: true }, 'working')).toEqual({
      changed: true,
      moves: [{ closed: { exitCode: 1 } }],
    })
  })

  it('closes a session the runner reported as failed', () => {
    expect(record('session.failed', { claudeSessionId: 'sess-1' }, 'working')).toEqual({
      changed: true,
      moves: [{ closed: { exitCode: 1 } }],
    })
  })

  it('ignores an event that names no session', () => {
    expect(record('session.result', {})).toEqual({ changed: false, moves: [] })
  })

  it('ignores an event about a session the board never registered', () => {
    expect(record('session.result', { claudeSessionId: 'ghost' })).toEqual({
      changed: false,
      moves: [],
    })
  })

  it('ignores the events that say nothing about the lifecycle', () => {
    expect(record('session.system', { claudeSessionId: 'sess-1' })).toEqual({
      changed: false,
      moves: [],
    })
  })

  it('never reopens a session that is already over', () => {
    expect(record('session.result', { claudeSessionId: 'sess-1' }, 'finished')).toEqual({
      changed: false,
      moves: [],
    })
  })
})
