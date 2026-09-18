import { Hono } from 'hono'
import { z } from 'zod'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { StoryNotFoundError, StoryViolationError } from '../Story/StoryViolation.js'
import { assertStoryHand } from '../Story/StoryHand.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import { framedTurn, type SessionTalker } from './Conversation.js'
import { openingOf, threadOf, validationRefusalOf, voiceOf } from './Thread.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { DiscussionRepository } from '../Discussion/DiscussionRepository.js'
import type { TemplateRepository } from '../Template/TemplateRepository.js'

const identifierSchema = z.coerce.number().int().positive()

const turnSchema = z.object({ message: z.string().trim().min(1).max(4000) })

export const AGENT_SESSION_HEADER = 'x-forge-session'

export type ConversationApiInput = {
  stories: StoryRepository
  sessions: AgentSessionRepository
  talker: SessionTalker
  events: EventBus
  discussion: DiscussionRepository
  checkpoints: CheckpointRepository
  templates: TemplateRepository
}

export function createConversationApi({
  stories,
  sessions,
  talker,
  events,
  discussion,
  checkpoints,
  templates,
}: ConversationApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof StoryNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof StoryViolationError) {
      return context.json({ error: error.name, message: error.message }, 409)
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
    assertStoryHand(story.reference, stories.assigneeOf(story.epicId), operatorOf(context))
    const session = sessions.latestSessionOf(story.id)
    if (session === null) {
      return context.json({ error: 'NoSessionToTalkTo', reference: story.reference }, 409)
    }
    if (!talker.isLive(session.claudeSessionId)) {
      return context.json({ error: 'ConversationClosed', reference: story.reference }, 409)
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

  api.delete('/api/stories/:id/talk', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const story = stories.findStory(storyId.data)
    assertStoryHand(story.reference, stories.assigneeOf(story.epicId), operatorOf(context))
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

  api.get('/api/stories/:id/thread', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const story = stories.findStory(storyId.data)
    return context.json(
      threadOf(
        story,
        {
          sessions: sessions.listSessionsOf(story.id),
          remarks: discussion.listRemarks(story.id),
          proofs: checkpoints.listProofs(story.id),
        },
        openingOf(templates.templateOfProject(stories.projectOfStory(story.id)).columns, story),
      ),
    )
  })

  api.post('/api/stories/:id/validate', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const story = stories.findStory(storyId.data)
    const refusal = validationRefusalOf(
      story.state,
      voiceOf(context.req.header(AGENT_SESSION_HEADER) ?? null),
    )
    if (refusal !== null) {
      return context.json({ error: refusal, reference: story.reference }, 409)
    }
    const validated = stories.sendToBacklog(story.id)
    events.publish({
      name: 'story.validated',
      payload: { reference: story.reference, validatedBy: operatorOf(context) },
    })
    return context.json(validated)
  })

  return api
}
