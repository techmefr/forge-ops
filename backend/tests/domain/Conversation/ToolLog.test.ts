import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createToolLogRepository, recordToolLogFromEvent } from '../../../src/domain/Conversation/ToolLogRepository.js'
import type { BoardEvent } from '../../../src/technical/Http/EventBus.js'

let db: Database.Database
let toolLogs: ReturnType<typeof createToolLogRepository>

const sessions = {
  findByClaudeSessionId: (id: string) => (id === 'c-1' ? ({ storyId: 7 } as never) : null),
}

function event(name: string, tools: unknown): BoardEvent {
  return { name, payload: { claudeSessionId: 'c-1', tools } } as BoardEvent
}

beforeEach(() => {
  db = openDatabase(':memory:')
  db.pragma('foreign_keys = OFF')
  toolLogs = createToolLogRepository(db)
})

describe('the raw output of the tools', () => {
  it('keeps what a tool was asked and what it answered', () => {
    recordToolLogFromEvent(
      { sessions, toolLogs },
      event('session.assistant', [{ id: 't1', name: 'Bash', outcome: 'started', input: '{"command":"ls"}' }]),
    )
    recordToolLogFromEvent({ sessions, toolLogs }, event('session.user', [{ id: 't1', name: '', outcome: 'ok', output: 'a.ts\nb.ts' }]))
    expect(toolLogs.listOfStory(7)).toEqual([
      expect.objectContaining({ id: 't1', name: 'Bash', input: '{"command":"ls"}', output: 'a.ts\nb.ts', failed: false }),
    ])
  })

  it('marks a failed tool and ignores the events of an unknown session', () => {
    recordToolLogFromEvent({ sessions, toolLogs }, event('session.assistant', [{ id: 't2', name: 'Read', outcome: 'started', input: '' }]))
    recordToolLogFromEvent({ sessions, toolLogs }, event('session.user', [{ id: 't2', name: '', outcome: 'failed', output: 'no such file' }]))
    recordToolLogFromEvent(
      { sessions, toolLogs },
      { name: 'session.user', payload: { claudeSessionId: 'other', tools: [{ id: 't3', outcome: 'started' }] } } as BoardEvent,
    )
    const logs = toolLogs.listOfStory(7)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ failed: true, output: 'no such file' })
  })

  it('does not write the same tool twice', () => {
    const started = event('session.assistant', [{ id: 't1', name: 'Bash', outcome: 'started', input: 'x' }])
    recordToolLogFromEvent({ sessions, toolLogs }, started)
    recordToolLogFromEvent({ sessions, toolLogs }, started)
    expect(toolLogs.listOfStory(7)).toHaveLength(1)
  })
})
