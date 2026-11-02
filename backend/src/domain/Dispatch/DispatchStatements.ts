import type Database from 'better-sqlite3'

export const RUNNING_LIFECYCLES = ['starting', 'working', 'awaiting_human'] as const
export const BUSY_LIFECYCLES = ['starting', 'working'] as const

export type DispatchStatements = ReturnType<typeof prepareDispatchStatements>

export function prepareDispatchStatements(database: Database.Database) {
  const placeholders = RUNNING_LIFECYCLES.map(() => '?').join(', ')
  const countRunningSessions = database.prepare<string[], { total: number }>(
    `SELECT COUNT(*) AS total FROM agent_session WHERE lifecycle IN (${placeholders})`,
  )
  const busyPlaceholders = BUSY_LIFECYCLES.map(() => '?').join(', ')
  return {
    countRunning: (): number => countRunningSessions.get(...RUNNING_LIFECYCLES)?.total ?? 0,
    countBusyOnStory: database.prepare<[number, ...string[]], { total: number }>(
      `SELECT COUNT(*) AS total FROM agent_session
        WHERE story_id = ? AND lifecycle IN (${busyPlaceholders})`,
    ),
    selectWaitingOnStory: database.prepare<[number], { claude_session_id: string }>(
      `SELECT claude_session_id FROM agent_session
        WHERE story_id = ? AND lifecycle = 'awaiting_human'`,
    ),
    selectBlockers: database.prepare<[number], { reference: string }>(
      `SELECT story.reference AS reference FROM story_dependency
         JOIN story ON story.id = story_dependency.blocking_story_id
        WHERE story_dependency.blocked_story_id = ?
          AND story.state <> 'done'
        ORDER BY story.reference`,
    ),
  }
}
