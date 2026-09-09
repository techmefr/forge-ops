import { Hono } from 'hono'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'
import type { ForemergeRepository } from './ForemergeRepository.js'
import { ScopeTakenError, ScopeViolationError } from './ForemergeViolation.js'

const identifierSchema = z.coerce.number().int().positive()

const claimSchema = z.object({
  pathPrefix: z.string().min(1).max(400),
  symbols: z.array(z.string().min(1).max(200)).max(50).default([]),
})

export type ForemergeApiInput = {
  foremerge: ForemergeRepository
  events: EventBus
}

export function createForemergeApi({ foremerge, events }: ForemergeApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof StoryNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof ScopeTakenError) {
      return context.json({ error: error.name, message: error.message, heldBy: error.heldBy }, 409)
    }
    if (error instanceof ScopeViolationError) {
      return context.json({ error: error.name, message: error.message }, 422)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

  api.get('/api/scope/reservations', (context) => context.json(foremerge.listReservations()))

  api.get('/api/scope/collisions', (context) => context.json(foremerge.collisions()))

  api.post('/api/stories/:id/scope', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const claim = claimSchema.safeParse(await context.req.json().catch(() => null))
    if (!claim.success) {
      return context.json({ error: 'InvalidScopeClaim', issues: claim.error.issues }, 422)
    }
    const reserved = foremerge.reserve({ storyId: storyId.data, ...claim.data })
    events.publish({ name: 'scope.reserved', payload: { ...reserved } })
    return context.json(reserved, 201)
  })

  api.delete('/api/stories/:id/scope', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const released = foremerge.release(storyId.data)
    events.publish({ name: 'scope.released', payload: { storyId: storyId.data, released } })
    return context.json({ released })
  })

  return api
}
