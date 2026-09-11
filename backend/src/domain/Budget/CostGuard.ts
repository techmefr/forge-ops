import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import { STALE_STORY_STATE } from '../Agent/Heartbeat.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { BudgetRepository } from './BudgetRepository.js'

const RUNNING = ['starting', 'working', 'awaiting_human']

export type CostGuardInput = {
  sessions: AgentSessionRepository
  stories: StoryRepository
  budget: BudgetRepository
  hangUp: (claudeSessionId: string) => void
}

export function stopRunOverCap(
  { sessions, stories, budget, hangUp }: CostGuardInput,
  claudeSessionId: string,
): boolean {
  const session = sessions.findByClaudeSessionId(claudeSessionId)
  if (session === null || !RUNNING.includes(session.lifecycle)) {
    return false
  }
  if (budget.decideConduct().conduct !== 'stop') {
    return false
  }
  sessions.closeSession(claudeSessionId, { exitCode: null, reason: 'budget' })
  stories.moveToState(session.storyId, STALE_STORY_STATE)
  hangUp(claudeSessionId)
  return true
}
