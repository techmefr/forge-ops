import { Hono } from 'hono'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'
import type { DiscussionRepository } from './DiscussionRepository.js'
import { EmptyRemarkError, StoryAlreadyHeldError } from './DiscussionViolation.js'

const identifierSchema = z.coerce.number().int().positive()

const remarkSchema = z.object({ body: z.string().trim().min(1).max(4000) })

const holdSchema = z.object({ reason: z.string().trim().min(1).max(400) })

export type DiscussionApiInput = {
  stories: StoryRepository
  discussion: DiscussionRepository
  events: EventBus
}

export function createDiscussionApi({ stories, discussion, events }: DiscussionApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof StoryNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof StoryAlreadyHeldError) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    if (error instanceof EmptyRemarkError) {
      return context.json({ error: error.name, message: error.message }, 422)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

  api.get('/api/board/holds', (context) => context.json(discussion.openHolds()))

  api.get('/api/stories/:id/discussion', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const story = stories.findStory(storyId.data)
    return context.json({
      remarks: discussion.listRemarks(story.id),
      hold: discussion.openHold(story.id),
    })
  })

  api.post('/api/stories/:id/discussion', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const draft = remarkSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'EmptyRemark' }, 422)
    }
    const story = stories.findStory(storyId.data)
    const held = discussion.openHold(story.id)
    const remark = discussion.writeRemark({
      storyId: story.id,
      author: operatorOf(context),
      voice: 'human',
      body: draft.data.body,
    })
    events.publish({
      name: 'story.remarked',
      payload: { reference: story.reference, author: remark.author, text: remark.body },
    })
    if (held !== null) {
      events.publish({
        name: 'story.freed',
        payload: { reference: story.reference, reason: held.reason, freedBy: remark.author },
      })
    }
    return context.json(remark, 201)
  })

  api.post('/api/stories/:id/hold', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const draft = holdSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'MissingHoldReason' }, 422)
    }
    const story = stories.findStory(storyId.data)
    const held = discussion.hold({
      storyId: story.id,
      reason: draft.data.reason,
      askedBy: operatorOf(context),
    })
    events.publish({
      name: 'story.held',
      payload: { reference: story.reference, reason: held.reason, askedBy: held.askedBy },
    })
    return context.json(held, 201)
  })

  return api
}
