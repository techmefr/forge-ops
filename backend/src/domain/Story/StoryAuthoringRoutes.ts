import type { Hono } from 'hono'
import { z } from 'zod'
import { parseBody } from '../../technical/Http/ParseBody.js'
import { assertHandOf } from './StoryHand.js'
import { identifierSchema, type StoryApiInput } from './StoryRouteSupport.js'

const cardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
})

const storyDraftSchema = z.object({
  epicId: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1),
})

const twinDraftSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
})

const estimateSchema = z.object({ points: z.number() })

const rolloutSchema = z.object({ percent: z.number() })

export function mountStoryAuthoringRoutes(api: Hono, { repository, events }: Pick<StoryApiInput, 'repository' | 'events'>): void {
  api.post('/api/stories', async (context) => {
    const draft = await parseBody(context, storyDraftSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidStoryDraft', issues: draft.error.issues }, 422)
    }
    const story = repository.writeStory(draft.data)
    events.publish({ name: 'story.written', payload: { ...story } })
    return context.json(story, 201)
  })

  api.put('/api/stories/:id', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const draft = await parseBody(context, cardSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidCard', issues: draft.error.issues }, 422)
    }
    const current = repository.findStory(storyId.data)
    assertHandOf(context, current.reference, repository.assigneeOf(current.epicId))
    const story = repository.editStory(storyId.data, draft.data)
    events.publish({ name: 'story.edited', payload: { ...story } })
    return context.json(story)
  })

  api.post('/api/stories/:id/twin', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const draft = await parseBody(context, twinDraftSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidTwinDraft', issues: draft.error.issues }, 422)
    }
    return context.json(repository.writeTwin({ storyId: storyId.data, ...draft.data }), 201)
  })

  api.post('/api/stories/:id/backlog', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(repository.sendToBacklog(storyId.data))
  })

  api.get('/api/stories/backlog', (context) => context.json(repository.listBacklog()))

  api.post('/api/stories/:id/estimate', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = await parseBody(context, estimateSchema)
    if (!body.success) {
      return context.json({ error: 'InvalidEstimate', issues: body.error.issues }, 422)
    }
    return context.json(repository.estimate(storyId.data, body.data.points))
  })

  api.post('/api/stories/:id/rollout', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = await parseBody(context, rolloutSchema)
    if (!body.success) {
      return context.json({ error: 'InvalidRollout', issues: body.error.issues }, 422)
    }
    return context.json(repository.rollOut(storyId.data, body.data.percent))
  })
}
