import type { SpokenTurn } from '../../domain/Conversation/Conversation.js'
import type { LiveSessions } from './LiveSessions.js'

export type SdkUserTurn = {
  type: 'user'
  message: { role: 'user'; content: string }
  parent_tool_use_id: null
}

export type TurnRoute = 'live' | 'closed'

export function userTurn(text: string): SdkUserTurn {
  return { type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null }
}

export function deliverTurn(turn: SpokenTurn, live: LiveSessions<SdkUserTurn>): TurnRoute {
  const channel = live.find(turn.claudeSessionId)
  return channel !== null && channel.push(userTurn(turn.message)) ? 'live' : 'closed'
}
