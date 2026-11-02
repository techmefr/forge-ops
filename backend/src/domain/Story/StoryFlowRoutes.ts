import type { Hono } from 'hono'
import { z } from 'zod'
import { parseBody } from '../../technical/Http/ParseBody.js'
import { identifierSchema, type StoryApiInput } from './StoryRouteSupport.js'

const dependencySchema = z.object({ blockingStoryId: z.number().int().positive() })

const blockSchema = z.object({ reason: z.string().trim().min(1).max(500) })

export function mountStoryFlowRoutes(api: Hono, { repository, events }: Pick<StoryApiInput, 'repository' | 'events'>): void {
  api.post('/api/stories/:id/dependencies', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = await parseBody(context, dependencySchema)
    if (!body.success) {
      return context.json({ error: 'InvalidDependency', issues: body.error.issues }, 422)
    }
    repository.addDependency({
      blockedStoryId: storyId.data,
      blockingStoryId: body.data.blockingStoryId,
    })
    return context.json({ blockers: repository.listBlockers(storyId.data) }, 201)
  })

  api.post('/api/stories/:id/plan/accept', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const story = repository.findStory(storyId.data)
    if (story.state !== 'plan_review') {
      return context.json({ error: 'PlanNotSettled', state: story.state }, 409)
    }
    const building = repository.startBuilding(storyId.data)
    events.publish({ name: 'story.moved', payload: { storyId: building.id, state: building.state } })
    return context.json(building)
  })

  api.post('/api/stories/:id/merge-conflict', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(repository.markMergeConflict(storyId.data))
  })

  api.delete('/api/stories/:id/merge-conflict', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(repository.clearMergeConflict(storyId.data))
  })

  api.post('/api/stories/:id/block', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = await parseBody(context, blockSchema)
    if (!body.success) {
      return context.json({ error: 'InvalidBlockedReason', issues: body.error.issues }, 422)
    }
    const story = repository.blockStory(storyId.data, body.data.reason)
    events.publish({ name: 'story.blocked', payload: { ...story } })
    return context.json(story)
  })

  api.delete('/api/stories/:id/block', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const story = repository.unblockStory(storyId.data)
    events.publish({ name: 'story.unblocked', payload: { ...story } })
    return context.json(story)
  })
}
