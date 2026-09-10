import type { SpokenTurn } from '../../domain/Conversation/Conversation.js'
import type { LiveSessions } from './LiveSessions.js'

export type SdkUserTurn = {
  type: 'user'
  message: { role: 'user'; content: string }
  parent_tool_use_id: null
}

export type TurnRoute = 'live' | 'resumed'

export function userTurn(text: string): SdkUserTurn {
  return { type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null }
}

export function deliverTurn(
  turn: SpokenTurn,
  live: LiveSessions<SdkUserTurn>,
  resume: (turn: SpokenTurn) => void,
): TurnRoute {
  const channel = live.find(turn.claudeSessionId)
  if (channel !== null && channel.push(userTurn(turn.message))) {
    return 'live'
  }
  resume(turn)
  return 'resumed'
}
