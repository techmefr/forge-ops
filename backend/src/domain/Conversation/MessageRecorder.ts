import type { BoardEvent } from '../../technical/Http/EventBus.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { MessageRepository } from './MessageRepository.js'

export type MessageRecorderInput = {
  sessions: Pick<AgentSessionRepository, 'findByClaudeSessionId'>
  messages: Pick<MessageRepository, 'record'>
}

export function recordMessageFromEvent({ sessions, messages }: MessageRecorderInput, event: BoardEvent): boolean {
  if (event.name !== 'session.assistant') {
    return false
  }
  const { claudeSessionId, text } = event.payload
  if (typeof claudeSessionId !== 'string' || claudeSessionId === '' || typeof text !== 'string') {
    return false
  }
  const session = sessions.findByClaudeSessionId(claudeSessionId)
  if (session === null) {
    return false
  }
  return messages.record({
    storyId: session.storyId,
    claudeSessionId,
    voice: 'agent',
    author: session.agentName === '' ? 'agent' : session.agentName,
    body: text,
  })
}
