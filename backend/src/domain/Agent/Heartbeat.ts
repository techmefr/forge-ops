import type { StoryRepository } from '../Story/StoryRepository.js'
import type { AgentSession } from './AgentSession.js'
import type { AgentSessionRepository } from './AgentSessionRepository.js'

export const STALE_AFTER_SECONDS = 600

export const STALE_STORY_STATE = 'escalated'

export type StaleSession = AgentSession & {
  silentForSeconds: number
}

export type ReapedSession = StaleSession & {
  statement: string
}

export type HeartbeatReaperInput = {
  sessions: AgentSessionRepository
  stories: StoryRepository
  staleAfterSeconds?: number
}

function statementOf(session: StaleSession): string {
  return [
    `Session declaree morte apres un silence de ${Math.round(session.silentForSeconds)} secondes`,
    `en phase ${session.phase} : la story attend un humain`,
  ].join(' ')
}

export function reapStaleSessions({
  sessions,
  stories,
  staleAfterSeconds = STALE_AFTER_SECONDS,
}: HeartbeatReaperInput): readonly ReapedSession[] {
  return sessions.listStaleSessions(staleAfterSeconds).map((stale) => {
    sessions.closeSession(stale.claudeSessionId, { exitCode: null, timedOut: true })
    stories.moveToState(stale.storyId, STALE_STORY_STATE)
    return { ...stale, statement: statementOf(stale) }
  })
}
