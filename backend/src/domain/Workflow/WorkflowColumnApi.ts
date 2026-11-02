import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  workflowColumnDraftSchema,
  workflowColumnOrderSchema,
  type ProjectWorkflow,
  type WorkflowAdmin,
} from '../../../../contract/WorkflowColumnContract.js'
import type { WorkflowColumnRepository } from './WorkflowColumnRepository.js'
import {
  createWorkflowColumnGuards,
  identifierSchema,
  mapWorkflowColumnError,
} from './WorkflowColumnApiSupport.js'
import { parseBody } from '../../technical/Http/ParseBody.js'

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

  api.onError(mapWorkflowColumnError)

  const { workflowOf, guard, guardAdmin } = createWorkflowColumnGuards(projectExists, mayAdminister)

  api.get('/api/projects/:id/workflow-columns', (context) => {
    const guarded = guard(context)
    if (guarded instanceof Response) {
      return guarded
    }
    const workflowId = workflowOf(context)
    if (workflowId instanceof Response) {
      return workflowId
    }
    const workflow: ProjectWorkflow = {
      columns: columns.list(guarded.projectId, workflowId),
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
    const workflowId = workflowOf(context)
    if (workflowId instanceof Response) {
      return workflowId
    }
    const draft = await parseBody(context, workflowColumnDraftSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidWorkflowColumn', issues: draft.error.issues }, 422)
    }
    return context.json({ column: columns.create(guarded.projectId, draft.data, workflowId) }, 201)
  })

  api.put('/api/projects/:id/workflow-columns/order', async (context) => {
    const guarded = guardAdmin(context)
    if (guarded instanceof Response) {
      return guarded
    }
    const workflowId = workflowOf(context)
    if (workflowId instanceof Response) {
      return workflowId
    }
    const body = await parseBody(context, workflowColumnOrderSchema)
    if (!body.success) {
      return context.json({ error: 'InvalidWorkflowColumnOrder', issues: body.error.issues }, 422)
    }
    return context.json({ columns: columns.reorder(guarded.projectId, body.data.keysInOrder, workflowId) })
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
    const draft = await parseBody(context, workflowColumnDraftSchema)
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
