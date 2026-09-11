import { Hono } from 'hono'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { StoryRepository } from './StoryRepository.js'
import { GATE_DEADLINE_MINUTES, statusOfWaits } from './HumanGate.js'

export type HumanGateApiInput = {
  stories: StoryRepository
  events: EventBus
  deadlineMinutes?: number
}

export function createHumanGateApi({
  stories,
  events,
  deadlineMinutes = GATE_DEADLINE_MINUTES,
}: HumanGateApiInput): Hono {
  const alreadyShouted = new Set<number>()
  const api = new Hono()

  api.get('/api/board/human-gates', (context) => {
    const gates = statusOfWaits(stories.listHumanGateWaits(), deadlineMinutes)
    for (const gate of gates) {
      if (!gate.overdue || alreadyShouted.has(gate.storyId)) {
        continue
      }
      alreadyShouted.add(gate.storyId)
      events.publish({
        name: 'story.gate_overdue',
        payload: {
          storyId: gate.storyId,
          reference: gate.reference,
          state: gate.state,
          waitingHours: gate.waitingHours,
          statement: gate.statement,
        },
      })
    }
    for (const storyId of [...alreadyShouted]) {
      if (!gates.some((gate) => gate.storyId === storyId && gate.overdue)) {
        alreadyShouted.delete(storyId)
      }
    }
    return context.json({ deadlineMinutes, gates })
  })

  return api
}
