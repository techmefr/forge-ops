import { Hono } from 'hono'
import { z } from 'zod'
import { epicPatchSchema, subjectLinksSchema, tagDraftSchema } from '../../../../contract/EpicContract.js'
import type { EventBus } from '../../technical/Http/EventBus.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import type { EpicRepository } from './EpicRepository.js'

const identifierSchema = z.coerce.number().int().positive()

const projectLinksSchema = z.object({ links: subjectLinksSchema })

export type EpicApiInput = {
  epics: EpicRepository
  events: EventBus
  today: () => string
}

export function createEpicApi({ epics, events, today }: EpicApiInput): Hono {
  const api = new Hono()

  api.patch('/api/epics/:id', async (context) => {
    const epicId = identifierSchema.safeParse(context.req.param('id'))
    if (!epicId.success) {
      return context.json({ error: 'InvalidEpicIdentifier' }, 422)
    }
    const patch = epicPatchSchema.safeParse(await context.req.json().catch(() => null))
    if (!patch.success) {
      return context.json({ error: 'InvalidEpicPatch', issues: patch.error.issues }, 422)
    }
    epics.plan(epicId.data, patch.data)
    const planning = epics.planningOfEpic(epicId.data, today())
    events.publish({ name: 'epic.updated', payload: { id: epicId.data } })
    return context.json({ id: epicId.data, ...planning })
  })

  api.get('/api/epics/:id/history', (context) => {
    const epicId = identifierSchema.safeParse(context.req.param('id'))
    if (!epicId.success) {
      return context.json({ error: 'InvalidEpicIdentifier' }, 422)
    }
    return context.json(epics.history(epicId.data))
  })

  api.delete('/api/epics/:id', (context) => {
    const epicId = identifierSchema.safeParse(context.req.param('id'))
    if (!epicId.success) {
      return context.json({ error: 'InvalidEpicIdentifier' }, 422)
    }
    epics.softDelete(epicId.data, operatorOf(context))
    events.publish({ name: 'epic.deleted', payload: { id: epicId.data } })
    return context.json({ deleted: true })
  })

  api.post('/api/epics/:id/restore', (context) => {
    const epicId = identifierSchema.safeParse(context.req.param('id'))
    if (!epicId.success) {
      return context.json({ error: 'InvalidEpicIdentifier' }, 422)
    }
    epics.restore(epicId.data, operatorOf(context))
    events.publish({ name: 'epic.restored', payload: { id: epicId.data } })
    return context.json({ restored: true })
  })

  api.get('/api/tags', (context) => context.json(epics.listTags()))

  api.post('/api/tags', async (context) => {
    const draft = tagDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidTag', issues: draft.error.issues }, 422)
    }
    return context.json(epics.createTag(draft.data), 201)
  })

  api.put('/api/tags/:id', async (context) => {
    const tagId = identifierSchema.safeParse(context.req.param('id'))
    const draft = tagDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!tagId.success || !draft.success) {
      return context.json({ error: 'InvalidTag' }, 422)
    }
    return context.json(epics.updateTag(tagId.data, draft.data))
  })

  api.delete('/api/tags/:id', (context) => {
    const tagId = identifierSchema.safeParse(context.req.param('id'))
    if (!tagId.success) {
      return context.json({ error: 'InvalidTagIdentifier' }, 422)
    }
    epics.deleteTag(tagId.data)
    return context.json({ deleted: true })
  })

  api.get('/api/projects/:id/links', (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    return context.json(epics.projectLinks(projectId.data))
  })

  api.put('/api/projects/:id/links', async (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    const body = projectLinksSchema.safeParse(await context.req.json().catch(() => null))
    if (!projectId.success || !body.success) {
      return context.json({ error: 'InvalidProjectLinks' }, 422)
    }
    epics.setProjectLinks(projectId.data, body.data.links)
    return context.json(epics.projectLinks(projectId.data))
  })

  return api
}
