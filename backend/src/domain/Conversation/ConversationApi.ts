import { Hono } from 'hono'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { StoryNotFoundError, StoryViolationError } from '../Story/StoryViolation.js'
import { assertHandOf } from '../Story/StoryHand.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import type { SessionTalker } from './Conversation.js'
import type { ToolLogRepository } from './ToolLogRepository.js'
import { openingOf, threadOf, validationRefusalOf, voiceOf } from './Thread.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { DiscussionRepository } from '../Discussion/DiscussionRepository.js'
import type { TemplateRepository } from '../Template/TemplateRepository.js'
import type { MessageRepository } from './MessageRepository.js'
import { identifierSchema, mountConversationTalkRoutes } from './ConversationTalkRoutes.js'

export const AGENT_SESSION_HEADER = 'x-forge-session'

export type ConversationApiInput = {
  stories: StoryRepository
  sessions: AgentSessionRepository
  talker: SessionTalker
  events: EventBus
  discussion: DiscussionRepository
  checkpoints: CheckpointRepository
  templates: TemplateRepository
  messages: MessageRepository
  toolLogs?: Pick<ToolLogRepository, 'listOfStory'>
}

export function createConversationApi(input: ConversationApiInput): Hono {
  const { stories, sessions, events, discussion, checkpoints, templates, messages, toolLogs } = input
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

  mountConversationTalkRoutes(api, input)

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
          messages: messages.listOfStory(story.id),
          toolLogs: toolLogs?.listOfStory(story.id) ?? [],
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
    assertHandOf(context, story.reference, stories.assigneeOf(story.epicId))
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
