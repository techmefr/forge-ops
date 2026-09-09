import { Hono } from 'hono'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'
import type { PilotRepository } from './PilotRepository.js'
import {
  PilotBrowserLostError,
  PilotRunAlreadyLiveError,
  PilotRunNotFoundError,
  PilotRunOverError,
  PilotRunPausedError,
  PilotViolationError,
} from './PilotViolation.js'

const identifierSchema = z.coerce.number().int().positive()

const stepSchema = z.object({
  kind: z.enum(['goto', 'click', 'fill', 'expectText', 'screenshot']),
  target: z.string().max(400).optional(),
  value: z.string().max(2000).optional(),
})

const orderSchema = z.object({
  url: z.string().url().max(400),
  pace: z.enum(['live', 'slow', 'step']),
  script: z.array(stepSchema).max(200),
})

export type PilotApiInput = {
  pilots: PilotRepository
  events: EventBus
}

export function createPilotApi({ pilots, events }: PilotApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof StoryNotFoundError || error instanceof PilotRunNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof PilotRunAlreadyLiveError || error instanceof PilotRunOverError) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    if (error instanceof PilotBrowserLostError) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    if (error instanceof PilotRunPausedError) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    if (error instanceof PilotViolationError) {
      return context.json({ error: error.name, message: error.message }, 422)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

  function storyOf(raw: string | undefined): number | null {
    const parsed = identifierSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  }

  api.get('/api/pilots', (context) => context.json(pilots.listLive()))

  api.get('/api/stories/:id/pilot', (context) => {
    const storyId = storyOf(context.req.param('id'))
    if (storyId === null) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json({
      run: pilots.findForStory(storyId),
      history: pilots.history(storyId),
    })
  })

  api.post('/api/stories/:id/pilot', async (context) => {
    const storyId = storyOf(context.req.param('id'))
    if (storyId === null) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const order = orderSchema.safeParse(await context.req.json().catch(() => null))
    if (!order.success) {
      return context.json({ error: 'InvalidPilotOrder', issues: order.error.issues }, 422)
    }
    const run = await pilots.start({ storyId, ...order.data })
    events.publish({ name: 'pilot.started', payload: { ...run } })
    return context.json(run, 201)
  })

  api.post('/api/stories/:id/pilot/advance', async (context) => {
    const storyId = storyOf(context.req.param('id'))
    if (storyId === null) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const run = await pilots.advance(storyId)
    events.publish({ name: 'pilot.advanced', payload: { ...run } })
    return context.json(run)
  })

  api.post('/api/stories/:id/pilot/pause', (context) => {
    const storyId = storyOf(context.req.param('id'))
    if (storyId === null) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const run = pilots.pause(storyId)
    events.publish({ name: 'pilot.paused', payload: { ...run } })
    return context.json(run)
  })

  api.post('/api/stories/:id/pilot/resume', (context) => {
    const storyId = storyOf(context.req.param('id'))
    if (storyId === null) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const run = pilots.resume(storyId)
    events.publish({ name: 'pilot.resumed', payload: { ...run } })
    return context.json(run)
  })

  api.post('/api/stories/:id/pilot/inspect', async (context) => {
    const storyId = storyOf(context.req.param('id'))
    if (storyId === null) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(await pilots.inspect(storyId))
  })

  api.delete('/api/stories/:id/pilot', async (context) => {
    const storyId = storyOf(context.req.param('id'))
    if (storyId === null) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const run = await pilots.abandon(storyId)
    events.publish({ name: 'pilot.ended', payload: { ...run } })
    return context.json(run)
  })

  return api
}
