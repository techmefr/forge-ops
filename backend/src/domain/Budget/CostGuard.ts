import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { BudgetRepository } from './BudgetRepository.js'

const RUNNING = ['starting', 'working', 'awaiting_human']

export type CostGuardInput = {
  sessions: AgentSessionRepository
  budget: BudgetRepository
  hangUp: (claudeSessionId: string) => void
}

export function stopRunOverCap({ sessions, budget, hangUp }: CostGuardInput, claudeSessionId: string): boolean {
  const session = sessions.findByClaudeSessionId(claudeSessionId)
  if (session === null || !RUNNING.includes(session.lifecycle)) {
    return false
  }
  if (budget.decideConduct().conduct !== 'stop') {
    return false
  }
  sessions.closeSession(claudeSessionId, { exitCode: null, reason: 'budget' })
  hangUp(claudeSessionId)
  return true
}
