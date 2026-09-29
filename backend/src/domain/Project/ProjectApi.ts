import { Hono } from 'hono'
import { z } from 'zod'
import { projectUpdateSchema } from '../../../../contract/ProjectContract.js'
import type { EventBus } from '../../technical/Http/EventBus.js'
import { LOCAL_OPERATOR, operatorOf } from '../../technical/Auth/BoardIdentity.js'
import type { ProjectRepository } from './ProjectRepository.js'

const identifierSchema = z.coerce.number().int().positive()

export type ProjectApiInput = {
  projects: ProjectRepository
  events: EventBus
  isSuperAdmin: (login: string) => boolean
}

export function createProjectApi({ projects, events, isSuperAdmin }: ProjectApiInput): Hono {
  const api = new Hono()

  api.get('/api/projects/sheets', (context) => context.json(projects.list()))

  api.put('/api/projects/:id', async (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    const patch = projectUpdateSchema.safeParse(await context.req.json().catch(() => null))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    if (!patch.success) {
      return context.json({ error: 'InvalidProjectUpdate', issues: patch.error.issues }, 422)
    }
    const current = projects.find(projectId.data)
    if (current === null) {
      return context.json({ error: 'ProjectNotFoundError' }, 404)
    }
    const login = operatorOf(context)
    const changesAdmin = patch.data.adminId !== undefined && patch.data.adminId !== current.adminUserId
    const mayChangeAdmin =
      current.adminUserId === null ||
      login === LOCAL_OPERATOR ||
      login === current.adminLogin ||
      isSuperAdmin(login)
    if (changesAdmin && !mayChangeAdmin) {
      return context.json({ error: 'ProjectAdminRequired' }, 403)
    }
    const sheet = projects.update(projectId.data, patch.data)
    events.publish({ name: 'project.updated', payload: { id: sheet.id } })
    return context.json(sheet)
  })

  api.delete('/api/projects/:id', (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    if (projects.find(projectId.data) === null) {
      return context.json({ error: 'ProjectNotFoundError' }, 404)
    }
    projects.remove(projectId.data)
    events.publish({ name: 'project.deleted', payload: { id: projectId.data } })
    return context.json({ deleted: true })
  })

  return api
}
