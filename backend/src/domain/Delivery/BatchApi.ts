import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { GROUPING_MODES } from './Grouping.js'
import {
  BatchNotFoundError,
  BatchRefusedError,
  type BatchRepository,
} from './BatchRepository.js'

const identifierSchema = z.coerce.number().int().positive()

const groupingSchema = z.object({ grouping: z.enum(GROUPING_MODES) })

const storySchema = z.object({ storyId: identifierSchema })

export type BatchApiInput = {
  batches: BatchRepository
  maySettle: (context: Context) => boolean
}

export function createBatchApi({ batches, maySettle }: BatchApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof BatchRefusedError) {
      return context.json({ error: 'BatchRefused', refusal: error.refusal }, 409)
    }
    if (error instanceof BatchNotFoundError) {
      return context.json({ error: 'BatchNotFound', message: error.message }, 404)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

  api.get('/api/delivery/grouping', (context) =>
    context.json({ grouping: batches.grouping(), maySettle: maySettle(context) }),
  )

  api.post('/api/delivery/grouping', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'GroupingNeedsAnAdmin' }, 403)
    }
    const body = groupingSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidGrouping' }, 422)
    }
    return context.json({ grouping: batches.settleGrouping(body.data.grouping) })
  })

  api.post('/api/batches', async (context) => {
    const body = storySchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(batches.openBatch(body.data.storyId), 201)
  })

  api.get('/api/batches/:id', (context) => {
    const batchId = identifierSchema.safeParse(context.req.param('id'))
    if (!batchId.success) {
      return context.json({ error: 'InvalidBatchIdentifier' }, 422)
    }
    return context.json(batches.findBatch(batchId.data))
  })

  api.post('/api/batches/:id/stories', async (context) => {
    const batchId = identifierSchema.safeParse(context.req.param('id'))
    const body = storySchema.safeParse(await context.req.json().catch(() => null))
    if (!batchId.success || !body.success) {
      return context.json({ error: 'InvalidBatchJoin' }, 422)
    }
    return context.json(batches.join(batchId.data, body.data.storyId))
  })

  api.post('/api/batches/:id/extract', async (context) => {
    const batchId = identifierSchema.safeParse(context.req.param('id'))
    const body = storySchema.safeParse(await context.req.json().catch(() => null))
    if (!batchId.success || !body.success) {
      return context.json({ error: 'InvalidExtraction' }, 422)
    }
    return context.json(batches.extract(batchId.data, body.data.storyId), 201)
  })

  return api
}
