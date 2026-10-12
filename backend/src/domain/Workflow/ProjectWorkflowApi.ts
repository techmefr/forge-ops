import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { workflowDraftSchema, type ProjectWorkflows } from '../../../../contract/WorkflowContract.js'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { ProjectWorkflowRepository } from './ProjectWorkflowRepository.js'
import { WorkflowInUseError, WorkflowNotFoundError, WorkflowRefusedError } from './ProjectWorkflowViolation.js'

const identifierSchema = z.coerce.number().int().positive()

export type ProjectWorkflowApiInput = {
  workflows: ProjectWorkflowRepository
  projectExists: (projectId: number) => boolean
  mayAdminister: (projectId: number, context: Context) => boolean
}

export function createProjectWorkflowApi({
  workflows,
  projectExists,
  mayAdminister,
}: ProjectWorkflowApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof WorkflowRefusedError) {
      return context.json({ error: 'WorkflowRefused', message: error.refusal.reason, refusal: error.refusal }, 422)
    }
    if (error instanceof WorkflowNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof WorkflowInUseError) {
      return context.json({ error: error.name, message: error.message, stories: error.stories }, 409)
    }
    return mapApiError(error, context)
  })

  function guard(context: Context, admin: boolean): { projectId: number } | Response {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    if (!projectExists(projectId.data)) {
      return context.json({ error: 'ProjectNotFoundError' }, 404)
    }
    if (admin && !mayAdminister(projectId.data, context)) {
      return context.json({ error: 'WorkflowNeedsTheProjectAdmin' }, 403)
    }
    return { projectId: projectId.data }
  }

  async function draftOf(context: Context): Promise<{ name: string } | Response> {
    const draft = workflowDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidWorkflow', issues: draft.error.issues }, 422)
    }
    return draft.data
  }

  function workflowIdOf(context: Context): number | Response {
    const parsed = identifierSchema.safeParse(context.req.param('workflowId'))
    return parsed.success ? parsed.data : context.json({ error: 'InvalidWorkflowIdentifier' }, 422)
  }

  api.get('/api/projects/:id/workflows', (context) => {
    const guarded = guard(context, false)
    if (guarded instanceof Response) {
      return guarded
    }
    const payload: ProjectWorkflows = {
      workflows: workflows.list(guarded.projectId),
      maySettle: mayAdminister(guarded.projectId, context),
    }
    return context.json(payload)
  })

  api.post('/api/projects/:id/workflows', async (context) => {
    const guarded = guard(context, true)
    if (guarded instanceof Response) {
      return guarded
    }
    const draft = await draftOf(context)
    if (draft instanceof Response) {
      return draft
    }
    return context.json({ workflow: workflows.create(guarded.projectId, draft.name) }, 201)
  })

  api.put('/api/projects/:id/workflows/:workflowId', async (context) => {
    const guarded = guard(context, true)
    const workflowId = workflowIdOf(context)
    if (guarded instanceof Response) {
      return guarded
    }
    if (workflowId instanceof Response) {
      return workflowId
    }
    const draft = await draftOf(context)
    if (draft instanceof Response) {
      return draft
    }
    return context.json({ workflow: workflows.rename(guarded.projectId, workflowId, draft.name) })
  })

  api.post('/api/projects/:id/workflows/:workflowId/duplicate', async (context) => {
    const guarded = guard(context, true)
    const workflowId = workflowIdOf(context)
    if (guarded instanceof Response) {
      return guarded
    }
    if (workflowId instanceof Response) {
      return workflowId
    }
    const draft = await draftOf(context)
    if (draft instanceof Response) {
      return draft
    }
    return context.json({ workflow: workflows.duplicate(guarded.projectId, workflowId, draft.name) }, 201)
  })

  api.delete('/api/projects/:id/workflows/:workflowId', (context) => {
    const guarded = guard(context, true)
    const workflowId = workflowIdOf(context)
    if (guarded instanceof Response) {
      return guarded
    }
    if (workflowId instanceof Response) {
      return workflowId
    }
    workflows.remove(guarded.projectId, workflowId)
    return context.json({ workflows: workflows.list(guarded.projectId) })
  })

  return api
}
