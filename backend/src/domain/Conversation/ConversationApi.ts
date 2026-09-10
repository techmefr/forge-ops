import { Hono } from 'hono'
import { z } from 'zod'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'
import { framedTurn, type SessionTalker } from './Conversation.js'

const identifierSchema = z.coerce.number().int().positive()

const turnSchema = z.object({ message: z.string().trim().min(1).max(4000) })

export type ConversationApiInput = {
  stories: StoryRepository
  sessions: AgentSessionRepository
  talker: SessionTalker
  events: EventBus
}

export function createConversationApi({
  stories,
  sessions,
  talker,
  events,
}: ConversationApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof StoryNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

  api.post('/api/stories/:id/talk', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const turn = turnSchema.safeParse(await context.req.json().catch(() => null))
    if (!turn.success) {
      return context.json({ error: 'EmptyTurn' }, 422)
    }
    const story = stories.findStory(storyId.data)
    const session = sessions.latestSessionOf(story.id)
    if (session === null) {
      return context.json({ error: 'NoSessionToTalkTo', reference: story.reference }, 409)
    }
    events.publish({
      name: 'session.human',
      payload: {
        reference: story.reference,
        phase: session.phase,
        claudeSessionId: session.claudeSessionId,
        text: turn.data.message,
      },
    })
    await talker.say({
      claudeSessionId: session.claudeSessionId,
      reference: story.reference,
      message: framedTurn(turn.data.message, story.reference),
    })
    return context.json({ said: true, claudeSessionId: session.claudeSessionId }, 202)
  })

  return api
}
