import { Hono } from 'hono'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { stateAfterCheckpoint } from '../Story/Advance.js'
import type { CascadeStep } from './ReviewCascade.js'
import { CHECKPOINT_SEQUENCE, REVIEW_LENS_SEQUENCE } from './Checkpoint.js'
import type { CheckpointRepository } from './CheckpointRepository.js'

const identifierSchema = z.coerce.number().int().positive()

const checkpointDraftSchema = z.object({
  name: z.enum(CHECKPOINT_SEQUENCE),
  evidencePath: z.string(),
})

const lensSchema = z.object({
  lens: z.enum(REVIEW_LENS_SEQUENCE),
  claudeSessionId: z.string().min(1),
})

export type CheckpointApiInput = {
  repository: StoryRepository
  checkpoints: CheckpointRepository
  events: EventBus
  advanceReviewCascade: (storyId: number) => Promise<CascadeStep>
}

export function createCheckpointApi({
  repository,
  checkpoints,
  events,
  advanceReviewCascade,
}: CheckpointApiInput): Hono {
  const api = new Hono()

  api.onError(mapApiError)

  api.post('/api/stories/:id/checkpoints', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const draft = checkpointDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidCheckpointDraft', issues: draft.error.issues }, 422)
    }
    const checkpoint = checkpoints.proveCheckpoint({ storyId: storyId.data, ...draft.data })
    events.publish({ name: 'checkpoint.proven', payload: { ...checkpoint } })
    const moved = stateAfterCheckpoint(draft.data.name)
    if (moved !== null) {
      const story = repository.moveToState(storyId.data, moved)
      events.publish({ name: 'story.moved', payload: { storyId: story.id, state: story.state } })
    }
    if (draft.data.name !== 'verified') {
      return context.json(checkpoint, 201)
    }
    const cascade = await advanceReviewCascade(storyId.data)
    events.publish({ name: 'review.cascade', payload: { storyId: storyId.data, ...cascade } })
    return context.json({ ...checkpoint, cascade }, 201)
  })

  api.get('/api/stories/:id/dod', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(checkpoints.definitionOfDone(storyId.data))
  })

  api.get('/api/stories/:id/review', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(checkpoints.reviewCascade(storyId.data))
  })

  api.post('/api/stories/:id/review', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = lensSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidReviewPass', issues: body.error.issues }, 422)
    }
    return context.json(
      checkpoints.startLens(storyId.data, body.data.lens, body.data.claudeSessionId),
      201,
    )
  })

  api.post('/api/stories/:id/review/:lens/pass', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const lens = z.enum(REVIEW_LENS_SEQUENCE).safeParse(context.req.param('lens'))
    if (!lens.success) {
      return context.json({ error: 'InvalidReviewLens' }, 422)
    }
    const passed = checkpoints.passLens(storyId.data, lens.data)
    const cascade = await advanceReviewCascade(storyId.data)
    events.publish({ name: 'review.cascade', payload: { storyId: storyId.data, ...cascade } })
    return context.json({ ...passed, cascade })
  })

  return api
}
