import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import { GitCommandFailedError } from '../../technical/Git/GitWorktree.js'
import { assertStoryHand } from '../Story/StoryHand.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { StoryNotFoundError, StoryNotYoursError } from '../Story/StoryViolation.js'
import { baseRefSchema } from './Worktree.js'
import type { WorktreeRepository } from './WorktreeRepository.js'
import {
  WorktreeAlreadyLiveError,
  WorktreeNotFoundError,
  WorktreeViolationError,
} from './WorktreeViolation.js'

const identifierSchema = z.coerce.number().int().positive()

const orderSchema = z.object({
  baseRef: baseRefSchema,
})

const closeSchema = z.object({
  force: z.boolean().default(false),
})

export type WorktreeApiInput = {
  worktrees: WorktreeRepository
  stories: StoryRepository
  events: EventBus
}

export function createWorktreeApi({ worktrees, stories, events }: WorktreeApiInput): Hono {
  const api = new Hono()

  function assertHand(context: Context, storyId: number): void {
    const story = stories.findStory(storyId)
    assertStoryHand(story.reference, stories.assigneeOf(story.epicId), operatorOf(context))
  }

  api.onError((error, context) => {
    if (error instanceof StoryNotFoundError || error instanceof WorktreeNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof StoryNotYoursError) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    if (error instanceof WorktreeAlreadyLiveError) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    if (error instanceof WorktreeViolationError) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    if (error instanceof GitCommandFailedError) {
      return context.json({ error: error.name, message: error.message }, 502)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

  api.get('/api/worktrees', (context) => context.json(worktrees.listLive()))

  api.get('/api/stories/:id/worktree', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(worktrees.findForStory(storyId.data))
  })

  api.post('/api/stories/:id/worktree', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const order = orderSchema.safeParse((await context.req.json().catch(() => null)) ?? {})
    if (!order.success) {
      return context.json({ error: 'InvalidWorktreeOrder', issues: order.error.issues }, 422)
    }
    assertHand(context, storyId.data)
    const opened = worktrees.open({ storyId: storyId.data, baseRef: order.data.baseRef })
    events.publish({ name: 'worktree.opened', payload: { ...opened } })
    return context.json(opened, 201)
  })

  api.delete('/api/stories/:id/worktree', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const options = closeSchema.safeParse((await context.req.json().catch(() => null)) ?? {})
    if (!options.success) {
      return context.json({ error: 'InvalidWorktreeClosure', issues: options.error.issues }, 422)
    }
    assertHand(context, storyId.data)
    worktrees.close(storyId.data, { force: options.data.force })
    events.publish({ name: 'worktree.closed', payload: { storyId: storyId.data } })
    return context.json({ closed: true })
  })

  return api
}
