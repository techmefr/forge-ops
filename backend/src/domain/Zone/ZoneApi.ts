import { Hono } from 'hono'
import { z } from 'zod'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { ZoneRepository } from './ZoneRepository.js'
import { parseBody } from '../../technical/Http/ParseBody.js'

const identifierSchema = z.coerce.number().int().positive()

const zoneDraftSchema = z.object({
  projectId: z.number().int().positive(),
  pathPrefix: z.string().min(1),
  name: z.string().min(1),
  colour: z.string().min(1),
})

const zoneSummarySchema = z.object({
  projectId: z.number().int().positive(),
  pathPrefix: z.string().min(1),
  summary: z.string().min(1),
})

export type ZoneApiInput = {
  zones: ZoneRepository
}

export function createZoneApi({ zones }: ZoneApiInput): Hono {
  const api = new Hono()

  api.onError(mapApiError)

  api.post('/api/zones', async (context) => {
    const draft = await parseBody(context, zoneDraftSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidZoneDraft', issues: draft.error.issues }, 422)
    }
    return context.json(zones.declareZone(draft.data), 201)
  })

  api.post('/api/zones/summary', async (context) => {
    const body = await parseBody(context, zoneSummarySchema)
    if (!body.success) {
      return context.json({ error: 'InvalidZoneSummary', issues: body.error.issues }, 422)
    }
    return context.json(
      zones.summariseZone(body.data.projectId, body.data.pathPrefix, body.data.summary),
    )
  })

  api.get('/api/projects/:id/zones', (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    return context.json(zones.overview(projectId.data))
  })

  return api
}
