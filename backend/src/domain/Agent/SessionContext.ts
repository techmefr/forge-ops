import { RUNNING_AGENT_LIFECYCLES } from '../../../../contract/AgentContract.js'
import type { SessionContext } from '../../../../contract/BoardContract.js'
import type { AgentSession } from './AgentSession.js'

export type { SessionContext }

export function sessionContextOf(session: AgentSession | null): SessionContext | null {
  if (session === null || !(RUNNING_AGENT_LIFECYCLES as readonly string[]).includes(session.lifecycle)) {
    return null
  }
  if (session.contextTokens === null) {
    return null
  }
  return { tokens: session.contextTokens, window: session.contextWindow }
}
