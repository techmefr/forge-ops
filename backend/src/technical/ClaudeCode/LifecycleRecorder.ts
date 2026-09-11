import type { SessionLedger } from './SessionLedger.js'
import type { BoardEvent } from '../Http/EventBus.js'

const RUNNING = ['starting', 'working', 'awaiting_human']

export function recordLifecycleFromEvent(sessions: SessionLedger, event: BoardEvent): boolean {
  const { claudeSessionId } = event.payload
  if (typeof claudeSessionId !== 'string' || claudeSessionId === '') {
    return false
  }
  const session = sessions.findByClaudeSessionId(claudeSessionId)
  if (session === null || !RUNNING.includes(session.lifecycle)) {
    return false
  }

  if (event.name === 'session.failed' || (event.name === 'session.result' && event.payload.isError === true)) {
    sessions.closeSession(claudeSessionId, { exitCode: 1 })
    return true
  }

  if (event.name === 'session.result') {
    sessions.updateLifecycle(claudeSessionId, 'awaiting_human')
    return true
  }

  if (event.name === 'session.assistant' && session.lifecycle === 'starting') {
    sessions.updateLifecycle(claudeSessionId, 'working')
    return true
  }

  return false
}
