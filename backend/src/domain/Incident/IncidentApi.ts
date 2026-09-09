import { Hono } from 'hono'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { IncidentRepository } from './IncidentRepository.js'
import {
  IncidentNotFoundError,
  IncidentViolationError,
  OriginNotFoundError,
} from './IncidentViolation.js'

const identifierSchema = z.coerce.number().int().positive()

const originDraftSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  kind: z.enum(['sentry', 'user_report', 'idea', 'manual']),
})

const reportSchema = z.object({
  fingerprint: z.string().min(1).max(400),
  title: z.string().min(1).max(400),
  detail: z.string().min(1).max(20000),
})

const acceptSchema = z.object({ epicId: z.number().int().positive() })

const refusalSchema = z.object({ reason: z.string().min(1).max(2000) })

const stateSchema = z.enum(['pending', 'accepted', 'refused'])

export type IncidentApiInput = {
  incidents: IncidentRepository
  events: EventBus
}

export function createIncidentApi({ incidents, events }: IncidentApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof IncidentNotFoundError || error instanceof OriginNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof IncidentViolationError) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

  api.post('/api/origins', async (context) => {
    const draft = originDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidOriginDraft', issues: draft.error.issues }, 422)
    }
    return context.json(incidents.declareOrigin(draft.data), 201)
  })

  api.get('/api/origins', (context) => context.json(incidents.listOrigins()))

  api.post('/api/origins/:slug/incidents', async (context) => {
    const report = reportSchema.safeParse(await context.req.json().catch(() => null))
    if (!report.success) {
      return context.json({ error: 'InvalidIncidentReport', issues: report.error.issues }, 422)
    }
    const incident = incidents.reportIncident({
      originSlug: context.req.param('slug'),
      ...report.data,
    })
    events.publish({ name: 'incident.reported', payload: { ...incident } })
    return context.json(incident, 202)
  })

  api.get('/api/incidents', (context) => {
    const asked = context.req.query('state')
    if (asked === undefined) {
      return context.json(incidents.listIncidents())
    }
    const state = stateSchema.safeParse(asked)
    if (!state.success) {
      return context.json({ error: 'InvalidIncidentState' }, 422)
    }
    return context.json(incidents.listIncidents(state.data))
  })

  api.post('/api/incidents/:id/accept', async (context) => {
    const incidentId = identifierSchema.safeParse(context.req.param('id'))
    if (!incidentId.success) {
      return context.json({ error: 'InvalidIncidentIdentifier' }, 422)
    }
    const body = acceptSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidAcceptance', issues: body.error.issues }, 422)
    }
    const accepted = incidents.acceptIncident(incidentId.data, body.data.epicId)
    events.publish({ name: 'incident.accepted', payload: { ...accepted.incident } })
    return context.json(accepted, 201)
  })

  api.post('/api/incidents/:id/refuse', async (context) => {
    const incidentId = identifierSchema.safeParse(context.req.param('id'))
    if (!incidentId.success) {
      return context.json({ error: 'InvalidIncidentIdentifier' }, 422)
    }
    const body = refusalSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidRefusal', issues: body.error.issues }, 422)
    }
    const refused = incidents.refuseIncident(incidentId.data, body.data.reason)
    events.publish({ name: 'incident.refused', payload: { ...refused } })
    return context.json(refused)
  })

  return api
}
