import type { SessionActivityEntry } from '../../../../contract/BoardContract.js'
import type { ThreadSession } from '../Conversation/Thread.js'
import { assertConfinedPath } from '../File/ConfinedPath.js'
import type { FileTouchDraft, PathConflict } from './AgentSession.js'
import type { SessionLookup, SessionUsage } from './AgentSessionLifecycle.js'
import type { AgentSessionStatements } from './AgentSessionStatements.js'

export function createSessionReads(
  {
    selectSessionsOfStory,
    sumStoryUsage,
    selectRecentActivity,
    insertFileTouch,
    selectTouchedPaths,
    selectConflictingPaths,
    selectStoriesTouching,
  }: AgentSessionStatements,
  { requireSession }: SessionLookup,
) {
  return {
    listSessionsOf: (storyId: number): readonly ThreadSession[] =>
      selectSessionsOfStory.all(storyId).map((row) => ({
        claudeSessionId: row.claude_session_id,
        phase: row.phase,
        agentName: row.agent_name,
        startedAt: row.started_at,
      })),

    sumUsage: (storyId: number): SessionUsage => {
      const row = sumStoryUsage.get(storyId)
      return {
        costUsd: row?.cost_usd ?? 0,
        inputTokens: row?.input_tokens ?? 0,
        outputTokens: row?.output_tokens ?? 0,
      }
    },

    listRecentActivity: (storyId: number, limit = 8): readonly SessionActivityEntry[] =>
      selectRecentActivity.all(storyId, limit).map((row) => ({
        claudeSessionId: row.claude_session_id,
        phase: row.phase,
        agentName: row.agent_name,
        lifecycle: row.lifecycle,
        outcome: row.outcome,
        startedAt: row.started_at,
        endedAt: row.ended_at,
      })),

    recordFileTouch: (draft: FileTouchDraft): void => {
      const path = assertConfinedPath(draft.path)
      const session = requireSession(draft.claudeSessionId)
      insertFileTouch.run(session.storyId, session.id, path)
    },

    listTouchedPaths: (storyId: number): readonly string[] => selectTouchedPaths.all(storyId).map((row) => row.path),

    listConflictingPaths: (): readonly PathConflict[] =>
      selectConflictingPaths.all().map((row) => ({
        path: row.path,
        storyIds: selectStoriesTouching.all(row.path).map((touch) => touch.story_id),
      })),
  }
}
