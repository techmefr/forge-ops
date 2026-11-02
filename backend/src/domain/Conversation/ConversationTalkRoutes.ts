import type { Hono } from 'hono'
import { z } from 'zod'
import { assertHandOf } from '../Story/StoryHand.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import { parseBody } from '../../technical/Http/ParseBody.js'
import { framedTurn } from './Conversation.js'
import type { ConversationApiInput } from './ConversationApi.js'

export const identifierSchema = z.coerce.number().int().positive()

const turnSchema = z.object({ message: z.string().trim().min(1).max(4000) })

export function mountConversationTalkRoutes(
  api: Hono,
  { stories, sessions, talker, events, messages }: Pick<ConversationApiInput, 'stories' | 'sessions' | 'talker' | 'events' | 'messages'>,
): void {
  api.post('/api/stories/:id/talk', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const turn = await parseBody(context, turnSchema)
    if (!turn.success) {
      return context.json({ error: 'EmptyTurn' }, 422)
    }
    const story = stories.findStory(storyId.data)
    assertHandOf(context, story.reference, stories.assigneeOf(story.epicId))
    const session = sessions.latestSessionOf(story.id)
    if (session === null) {
      return context.json({ error: 'NoSessionToTalkTo', reference: story.reference }, 409)
    }
    if (!talker.isLive(session.claudeSessionId)) {
      return context.json({ error: 'ConversationClosed', reference: story.reference }, 409)
    }
    messages.record({
      storyId: story.id,
      claudeSessionId: session.claudeSessionId,
      voice: 'human',
      author: operatorOf(context),
      body: turn.data.message,
    })
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

  api.delete('/api/stories/:id/talk', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const story = stories.findStory(storyId.data)
    assertHandOf(context, story.reference, stories.assigneeOf(story.epicId))
    const session = sessions.latestSessionOf(story.id)
    if (session === null || session.lifecycle === 'finished') {
      return context.json({ hungUp: false })
    }
    talker.hangUp(session.claudeSessionId)
    sessions.closeSession(session.claudeSessionId, { exitCode: null, signal: 'SIGTERM' })
    events.publish({
      name: 'session.hung_up',
      payload: {
        reference: story.reference,
        phase: session.phase,
        claudeSessionId: session.claudeSessionId,
      },
    })
    return context.json({ hungUp: true, claudeSessionId: session.claudeSessionId })
  })
}
