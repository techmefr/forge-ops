import type Database from 'better-sqlite3'
import type { SessionExit } from './SessionOutcome.js'
import type {
  AgentLifecycle,
  AgentSession,
  AgentSessionDraft,
  FileTouchDraft,
  PathConflict,
} from './AgentSession.js'
import {
  createSessionLifecycle,
  createSessionLookup,
  type ClosedSession,
  type SessionUsage,
} from './AgentSessionLifecycle.js'
import { createSessionReads } from './AgentSessionReads.js'
import { prepareAgentSessionStatements } from './AgentSessionStatements.js'
import type { StaleSession } from './Heartbeat.js'
import type { ThreadSession } from '../Conversation/Thread.js'
import type { SessionActivityEntry } from '../../../../contract/BoardContract.js'

export type { SessionActivityEntry }
export type { ClosedSession, SessionUsage } from './AgentSessionLifecycle.js'

export type AgentSessionRepository = {
  registerSession: (draft: AgentSessionDraft) => AgentSession
  findByClaudeSessionId: (claudeSessionId: string) => AgentSession | null
  latestSessionOf: (storyId: number) => AgentSession | null
  listSessionsOf: (storyId: number) => readonly ThreadSession[]
  updateLifecycle: (claudeSessionId: string, lifecycle: AgentLifecycle) => AgentSession
  recordHeartbeat: (claudeSessionId: string) => void
  listStaleSessions: (staleAfterSeconds?: number) => readonly StaleSession[]
  closeSession: (claudeSessionId: string, exit: SessionExit) => ClosedSession
  recordUsage: (
    claudeSessionId: string,
    usage: SessionUsage,
  ) => AgentSession & Pick<SessionUsage, 'inputTokens' | 'outputTokens'>
  abandonRunningSessions: () => number
  sumUsage: (storyId: number) => SessionUsage
  listRecentActivity: (storyId: number, limit?: number) => readonly SessionActivityEntry[]
  recordFileTouch: (draft: FileTouchDraft) => void
  listTouchedPaths: (storyId: number) => readonly string[]
  listConflictingPaths: () => readonly PathConflict[]
}

export function createAgentSessionRepository(db: Database.Database): AgentSessionRepository {
  const statements = prepareAgentSessionStatements(db)
  const lookup = createSessionLookup(statements)
  return {
    findByClaudeSessionId: lookup.findByClaudeSessionId,
    latestSessionOf: lookup.latestSessionOf,
    ...createSessionLifecycle(statements, lookup),
    ...createSessionReads(statements, lookup),
  }
}
