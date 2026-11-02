import type Database from 'better-sqlite3'
import type { AgentTally, BoardStatistics, OutcomeTally, PhaseTally, SessionHistoryEntry } from './Statistic.js'
import { prepareStatisticStatements } from './StatisticStatements.js'

export type StatisticRepository = {
  listHistory: () => readonly SessionHistoryEntry[]
  summarise: () => BoardStatistics
}

export function createStatisticRepository(db: Database.Database): StatisticRepository {
  const { selectHistory, selectAgents, selectPhases, selectOutcomes, selectTotals } = prepareStatisticStatements(db)

  return {
    listHistory: () =>
      selectHistory.all().map((row) => ({
        id: row.id,
        storyId: row.story_id,
        storyReference: row.reference,
        phase: row.phase,
        agentName: row.agent_name,
        lifecycle: row.lifecycle,
        outcome: row.outcome,
        costUsd: row.cost_usd,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        seconds: row.seconds,
      })),

    summarise: () => {
      const totals = selectTotals.get()
      const agents: AgentTally[] = selectAgents.all().map((row) => ({
        agentName: row.agent_name,
        sessions: row.sessions,
        totalSeconds: row.seconds,
        totalCostUsd: row.cost,
      }))
      const phases: PhaseTally[] = selectPhases.all().map((row) => ({
        phase: row.phase,
        sessions: row.sessions,
        totalSeconds: row.seconds,
      }))
      const outcomes: OutcomeTally[] = selectOutcomes.all().map((row) => ({
        outcome: row.outcome,
        sessions: row.sessions,
      }))
      return {
        sessions: totals?.sessions ?? 0,
        totalCostUsd: totals?.cost ?? 0,
        totalSeconds: totals?.seconds ?? 0,
        agents,
        phases,
        outcomes,
      }
    },
  }
}
