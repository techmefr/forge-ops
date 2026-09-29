import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import {
  workflowColumnDraftSchema,
  workflowColumnOrderSchema,
  type ProjectWorkflow,
  type WorkflowAdmin,
} from '../../../../contract/WorkflowColumnContract.js'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { WorkflowColumnRepository } from './WorkflowColumnRepository.js'
import {
  WorkflowColumnInUseError,
  WorkflowColumnNotFoundError,
  WorkflowColumnRefusedError,
} from './WorkflowColumnViolation.js'

const identifierSchema = z.coerce.number().int().positive()

export type WorkflowColumnApiInput = {
  columns: WorkflowColumnRepository
  projectExists: (projectId: number) => boolean
  mayAdminister: (projectId: number, context: Context) => boolean
  adminOf: (projectId: number) => WorkflowAdmin | null
}

export function createWorkflowColumnApi({
  columns,
  projectExists,
  mayAdminister,
  adminOf,
}: WorkflowColumnApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof WorkflowColumnRefusedError) {
      return context.json(
        { error: 'WorkflowColumnRefused', message: error.refusal.reason, refusal: error.refusal },
        422,
      )
    }
    if (error instanceof WorkflowColumnNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof WorkflowColumnInUseError) {
      return context.json({ error: error.name, message: error.message, stories: error.stories }, 409)
    }
    return mapApiError(error, context)
  })

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

  function guardAdmin(context: Context): { projectId: number } | Response {
    const guarded = guard(context)
    if (guarded instanceof Response) {
      return guarded
    }
    if (!mayAdminister(guarded.projectId, context)) {
      return context.json({ error: 'WorkflowNeedsTheProjectAdmin' }, 403)
    }
    return guarded
  }

  api.get('/api/projects/:id/workflow-columns', (context) => {
    const guarded = guard(context)
    if (guarded instanceof Response) {
      return guarded
    }
    const workflow: ProjectWorkflow = {
      columns: columns.list(guarded.projectId),
      maySettle: mayAdminister(guarded.projectId, context),
      admin: adminOf(guarded.projectId),
    }
    return context.json(workflow)
  })

  api.post('/api/projects/:id/workflow-columns', async (context) => {
    const guarded = guardAdmin(context)
    if (guarded instanceof Response) {
      return guarded
    }
    const draft = workflowColumnDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidWorkflowColumn', issues: draft.error.issues }, 422)
    }
    return context.json({ column: columns.create(guarded.projectId, draft.data) }, 201)
  })

  api.put('/api/projects/:id/workflow-columns/order', async (context) => {
    const guarded = guardAdmin(context)
    if (guarded instanceof Response) {
      return guarded
    }
    const body = workflowColumnOrderSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidWorkflowColumnOrder', issues: body.error.issues }, 422)
    }
    return context.json({ columns: columns.reorder(guarded.projectId, body.data.keysInOrder) })
  })

  api.put('/api/projects/:id/workflow-columns/:columnId', async (context) => {
    const guarded = guardAdmin(context)
    if (guarded instanceof Response) {
      return guarded
    }
    const columnId = identifierSchema.safeParse(context.req.param('columnId'))
    if (!columnId.success) {
      return context.json({ error: 'InvalidWorkflowColumnIdentifier' }, 422)
    }
    const draft = workflowColumnDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidWorkflowColumn', issues: draft.error.issues }, 422)
    }
    return context.json({ column: columns.update(guarded.projectId, columnId.data, draft.data) })
  })

  api.delete('/api/projects/:id/workflow-columns/:columnId', (context) => {
    const guarded = guardAdmin(context)
    if (guarded instanceof Response) {
      return guarded
    }
    const columnId = identifierSchema.safeParse(context.req.param('columnId'))
    if (!columnId.success) {
      return context.json({ error: 'InvalidWorkflowColumnIdentifier' }, 422)
    }
    columns.remove(guarded.projectId, columnId.data)
    return context.json({ columns: columns.list(guarded.projectId) })
  })

  return api
}
