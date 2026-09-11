import type { SessionLedger } from './SessionLedger.js'
import type { BoardEvent } from '../Http/EventBus.js'

const RUNNING = ['starting', 'working', 'awaiting_human']

export function recordHeartbeatFromEvent(sessions: SessionLedger, event: BoardEvent): boolean {
  const { claudeSessionId } = event.payload
  if (typeof claudeSessionId !== 'string' || claudeSessionId === '') {
    return false
  }
  const session = sessions.findByClaudeSessionId(claudeSessionId)
  if (session === null || !RUNNING.includes(session.lifecycle)) {
    return false
  }
  sessions.recordHeartbeat(claudeSessionId)
  return true
}
