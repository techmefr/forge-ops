import type { AgentLifecycle, AgentSession, AgentSessionDraft } from './AgentSession.js'
import { UnknownAgentSessionError } from './AgentViolation.js'
import { toAgentSession, type AgentSessionStatements } from './AgentSessionStatements.js'
import { STALE_AFTER_SECONDS, type StaleSession } from './Heartbeat.js'
import { classifyOutcome, lifecycleOfOutcome, type OutcomeClass, type SessionExit } from './SessionOutcome.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'

export type SessionUsage = {
  costUsd: number
  inputTokens: number
  outputTokens: number
  contextTokens?: number
  contextWindow?: number
}

export type ClosedSession = AgentSession & {
  outcome: OutcomeClass
  statement: string
}

export type SessionLookup = ReturnType<typeof createSessionLookup>

export function createSessionLookup({ selectSession, selectLatestOfStory }: AgentSessionStatements) {
  function findByClaudeSessionId(claudeSessionId: string): AgentSession | null {
    const row = selectSession.get(claudeSessionId)
    return row === undefined ? null : toAgentSession(row)
  }

  function latestSessionOf(storyId: number): AgentSession | null {
    const row = selectLatestOfStory.get(storyId)
    return row === undefined ? null : toAgentSession(row)
  }

  function requireSession(claudeSessionId: string): AgentSession {
    const session = findByClaudeSessionId(claudeSessionId)
    if (session === null) {
      throw new UnknownAgentSessionError(claudeSessionId)
    }
    return session
  }

  return { findByClaudeSessionId, latestSessionOf, requireSession }
}

function createSessionRegistration(
  { selectStory, selectSession, insertSession, resumeSessionRow }: AgentSessionStatements,
  { requireSession }: SessionLookup,
) {
  return {
    registerSession: (draft: AgentSessionDraft): AgentSession => {
      if (selectStory.get(draft.storyId) === undefined) {
        throw new StoryNotFoundError(draft.storyId)
      }
      if (selectSession.get(draft.claudeSessionId) !== undefined) {
        resumeSessionRow.run(
          draft.storyId,
          draft.phase,
          draft.agentName,
          draft.claudeCodeVersion,
          draft.claudeSessionId,
        )
        return requireSession(draft.claudeSessionId)
      }
      insertSession.run(draft.storyId, draft.claudeSessionId, draft.phase, draft.agentName, draft.claudeCodeVersion)
      return requireSession(draft.claudeSessionId)
    },
  }
}

export function createSessionLifecycle(statements: AgentSessionStatements, lookup: SessionLookup) {
  const { requireSession } = lookup
  const { updateSessionLifecycle, beatHeartbeat, selectStaleSessions, closeSessionRow, updateUsage, abandonRunning } =
    statements

  return {
    ...createSessionRegistration(statements, lookup),

    updateLifecycle: (claudeSessionId: string, lifecycle: AgentLifecycle): AgentSession => {
      requireSession(claudeSessionId)
      updateSessionLifecycle.run(lifecycle, lifecycle, lifecycle, claudeSessionId)
      return requireSession(claudeSessionId)
    },

    recordHeartbeat: (claudeSessionId: string): void => {
      requireSession(claudeSessionId)
      beatHeartbeat.run(claudeSessionId)
    },

    listStaleSessions: (staleAfterSeconds = STALE_AFTER_SECONDS): readonly StaleSession[] =>
      selectStaleSessions.all(staleAfterSeconds).map((row) => ({
        ...toAgentSession(row),
        silentForSeconds: row.silent_for_seconds,
      })),

    closeSession: (claudeSessionId: string, exit: SessionExit): ClosedSession => {
      requireSession(claudeSessionId)
      const verdict = classifyOutcome(exit)
      const lifecycle = lifecycleOfOutcome(verdict.outcome)
      closeSessionRow.run(lifecycle, verdict.outcome, claudeSessionId)
      return { ...requireSession(claudeSessionId), outcome: verdict.outcome, statement: verdict.statement }
    },

    recordUsage: (claudeSessionId: string, usage: SessionUsage) => {
      requireSession(claudeSessionId)
      updateUsage.run(
        usage.costUsd,
        usage.inputTokens,
        usage.outputTokens,
        usage.contextTokens ?? null,
        usage.contextWindow ?? null,
        claudeSessionId,
      )
      return {
        ...requireSession(claudeSessionId),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }
    },

    abandonRunningSessions: (): number => abandonRunning.run().changes,
  }
}
