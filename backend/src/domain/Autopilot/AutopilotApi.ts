import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { autopilotSettingsSchema, type ProjectAutopilot } from '../../../../contract/AutopilotContract.js'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { AutopilotRepository } from './AutopilotRepository.js'

const identifierSchema = z.coerce.number().int().positive()

export type AutopilotApiInput = {
  autopilot: AutopilotRepository
  projectExists: (projectId: number) => boolean
  mayAdminister: (projectId: number, context: Context) => boolean
}

export function createAutopilotApi({ autopilot, projectExists, mayAdminister }: AutopilotApiInput): Hono {
  const api = new Hono()

  api.onError(mapApiError)

  function guard(context: Context): { projectId: number } | Response {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    if (!projectExists(projectId.data)) {
      return context.json({ error: 'ProjectNotFoundError' }, 404)
    }
    return { projectId: projectId.data }
  }

  function viewOf(projectId: number, context: Context): ProjectAutopilot {
    return { ...autopilot.settingsOf(projectId), maySettle: mayAdminister(projectId, context) }
  }

  api.get('/api/projects/:id/autopilot', (context) => {
    const guarded = guard(context)
    if (guarded instanceof Response) {
      return guarded
    }
    return context.json(viewOf(guarded.projectId, context))
  })

  api.put('/api/projects/:id/autopilot', async (context) => {
    const guarded = guard(context)
    if (guarded instanceof Response) {
      return guarded
    }
    if (!mayAdminister(guarded.projectId, context)) {
      return context.json({ error: 'AutopilotNeedsTheProjectAdmin' }, 403)
    }
    const settings = autopilotSettingsSchema.safeParse(await context.req.json().catch(() => null))
    if (!settings.success) {
      return context.json({ error: 'InvalidAutopilotSettings', issues: settings.error.issues }, 422)
    }
    autopilot.settle(guarded.projectId, settings.data)
    return context.json(viewOf(guarded.projectId, context))
  })

  return api
}
