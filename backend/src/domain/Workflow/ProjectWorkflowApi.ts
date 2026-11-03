import { Hono } from 'hono'
import type { Context } from 'hono'
import type { ProjectWorkflows } from '../../../../contract/WorkflowContract.js'
import type { ProjectWorkflowRepository } from './ProjectWorkflowRepository.js'
import { createProjectWorkflowGuards, mapProjectWorkflowError } from './ProjectWorkflowApiSupport.js'

export type ProjectWorkflowApiInput = {
  workflows: ProjectWorkflowRepository
  projectExists: (projectId: number) => boolean
  mayAdminister: (projectId: number, context: Context) => boolean
}

type WorkflowGuards = ReturnType<typeof createProjectWorkflowGuards>

function mountWorkflowItemRoutes(
  api: Hono,
  workflows: ProjectWorkflowRepository,
  { guard, draftOf, workflowIdOf }: WorkflowGuards,
): void {
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
}

export function createProjectWorkflowApi({
  workflows,
  projectExists,
  mayAdminister,
}: ProjectWorkflowApiInput): Hono {
  const api = new Hono()

  api.onError(mapProjectWorkflowError)

  const { guard, draftOf, workflowIdOf } = createProjectWorkflowGuards(projectExists, mayAdminister)

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

  mountWorkflowItemRoutes(api, workflows, { guard, draftOf, workflowIdOf })

  return api
}
