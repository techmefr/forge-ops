import { Hono } from 'hono'
import { z } from 'zod'
import { eventDraftSchema, eventPatchSchema, eventWindowSchema } from '../../../../contract/EventContract.js'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { EventRepository } from './EventRepository.js'

const identifierSchema = z.coerce.number().int().positive()

export type EventApiInput = {
  agenda: EventRepository
  events: EventBus
}

export function createEventApi({ agenda, events }: EventApiInput): Hono {
  const api = new Hono()

  api.get('/api/projects/:id/events', (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    const window = eventWindowSchema.safeParse({
      from: context.req.query('from'),
      to: context.req.query('to'),
    })
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    if (!window.success) {
      return context.json({ error: 'InvalidEventWindow', issues: window.error.issues }, 422)
    }
    return context.json(agenda.listOfProject(projectId.data, window.data))
  })

  api.post('/api/events', async (context) => {
    const draft = eventDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidEventDraft', issues: draft.error.issues }, 422)
    }
    const event = agenda.create(draft.data)
    events.publish({ name: 'event.created', payload: { id: event.id, projectId: event.projectId } })
    return context.json(event, 201)
  })

  api.patch('/api/events/:id', async (context) => {
    const eventId = identifierSchema.safeParse(context.req.param('id'))
    if (!eventId.success) {
      return context.json({ error: 'InvalidEventIdentifier' }, 422)
    }
    const patch = eventPatchSchema.safeParse(await context.req.json().catch(() => null))
    if (!patch.success) {
      return context.json({ error: 'InvalidEventPatch', issues: patch.error.issues }, 422)
    }
    const event = agenda.update(eventId.data, patch.data)
    events.publish({ name: 'event.updated', payload: { id: event.id, projectId: event.projectId } })
    return context.json(event)
  })

  api.delete('/api/events/:id', (context) => {
    const eventId = identifierSchema.safeParse(context.req.param('id'))
    if (!eventId.success) {
      return context.json({ error: 'InvalidEventIdentifier' }, 422)
    }
    const event = agenda.find(eventId.data)
    agenda.remove(eventId.data)
    events.publish({ name: 'event.deleted', payload: { id: event.id, projectId: event.projectId } })
    return context.json({ deleted: true })
  })

  return api
}
