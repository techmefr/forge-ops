import type { BudgetRepository } from '../domain/Budget/BudgetRepository.js'
import { stopRunOverCap } from '../domain/Budget/CostGuard.js'
import type { AgentSessionRepository } from '../domain/Agent/AgentSessionRepository.js'
import type { MessageRepository } from '../domain/Conversation/MessageRepository.js'
import { recordMessageFromEvent } from '../domain/Conversation/MessageRecorder.js'
import { recordToolLogFromEvent, type ToolLogRepository } from '../domain/Conversation/ToolLogRepository.js'
import { recordHeartbeatFromEvent } from '../technical/ClaudeCode/HeartbeatRecorder.js'
import { recordLifecycleFromEvent } from '../technical/ClaudeCode/LifecycleRecorder.js'
import type { LiveSessions } from '../technical/ClaudeCode/LiveSessions.js'
import { recordUsageFromEvent } from '../technical/ClaudeCode/UsageRecorder.js'
import type { SdkUserTurn } from '../technical/ClaudeCode/TurnDelivery.js'
import type { BoardEvent, EventBus } from '../technical/Http/EventBus.js'

export type SessionEventSinkInput = {
  sessions: AgentSessionRepository
  messages: MessageRepository
  toolLogs: ToolLogRepository
  budget: BudgetRepository
  live: LiveSessions<SdkUserTurn>
  events: EventBus
  onTurnEnded: (claudeSessionId: string) => void
}

export function createSessionEventSink({
  sessions,
  messages,
  toolLogs,
  budget,
  live,
  events,
  onTurnEnded,
}: SessionEventSinkInput): (event: BoardEvent) => void {
  return (event) => {
    recordUsageFromEvent(sessions, event)
    recordHeartbeatFromEvent(sessions, event)
    recordLifecycleFromEvent(sessions, event)
    recordMessageFromEvent({ sessions, messages }, event)
    recordToolLogFromEvent({ sessions, toolLogs }, event)
    const { claudeSessionId } = event.payload
    if (typeof claudeSessionId === 'string' && claudeSessionId !== '') {
      stopRunOverCap(
        {
          sessions,
          budget,
          hangUp: (identifier) => {
            live.terminate(identifier)
          },
        },
        claudeSessionId,
      )
    }
    if (
      (event.name === 'session.result' || event.name === 'session.failed') &&
      typeof claudeSessionId === 'string' &&
      claudeSessionId !== ''
    ) {
      onTurnEnded(claudeSessionId)
    }
    events.publish(event)
  }
}
