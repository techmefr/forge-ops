import type { SessionLedger } from './SessionLedger.js'
import type { BoardEvent } from '../Http/EventBus.js'

export function recordUsageFromEvent(sessions: SessionLedger, event: BoardEvent): boolean {
  const { claudeSessionId, costUsd, inputTokens, outputTokens, contextTokens, contextWindow } = event.payload
  if (typeof claudeSessionId !== 'string' || claudeSessionId === '') {
    return false
  }
  if (typeof costUsd !== 'number' && typeof inputTokens !== 'number' && typeof outputTokens !== 'number') {
    return false
  }
  if (sessions.findByClaudeSessionId(claudeSessionId) === null) {
    return false
  }
  sessions.recordUsage(claudeSessionId, {
    costUsd: typeof costUsd === 'number' ? costUsd : 0,
    inputTokens: typeof inputTokens === 'number' ? inputTokens : 0,
    outputTokens: typeof outputTokens === 'number' ? outputTokens : 0,
    ...(typeof contextTokens === 'number' ? { contextTokens } : {}),
    ...(typeof contextWindow === 'number' ? { contextWindow } : {}),
  })
  return true
}
