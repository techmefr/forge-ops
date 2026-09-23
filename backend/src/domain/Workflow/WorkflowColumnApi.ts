import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { BEHAVIOURAL_KIND_SEQUENCE } from '../../../../contract/WorkflowColumnContract.js'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { WorkflowColumnRepository } from './WorkflowColumnRepository.js'
import { WorkflowColumnRefusedError } from './WorkflowColumnViolation.js'

const draftSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  colour: z.string().min(1),
  agentName: z.string(),
  command: z.string(),
  preprompt: z.string(),
  behaviouralKind: z.enum(BEHAVIOURAL_KIND_SEQUENCE),
})

const updateDraftSchema = draftSchema.omit({ key: true })

const reorderSchema = z.object({ keysInOrder: z.array(z.string()).min(1) })

export type WorkflowColumnApiInput = {
  columns: WorkflowColumnRepository
  maySettle: (context: Context) => boolean
}

export function createWorkflowColumnApi({ columns, maySettle }: WorkflowColumnApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof WorkflowColumnRefusedError) {
      return context.json({ error: 'WorkflowColumnRefused', refusal: error.refusal }, 422)
    }
    return mapApiError(error, context)
  })

  api.get('/api/settings/workflow-columns', (context) =>
    context.json({ columns: columns.list(), maySettle: maySettle(context) }),
  )

  api.post('/api/settings/workflow-columns', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'WorkflowColumnsNeedAnAdmin' }, 403)
    }
    const draft = draftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidWorkflowColumn', issues: draft.error.issues }, 422)
    }
    return context.json({ column: columns.create(draft.data) }, 201)
  })

  api.put('/api/settings/workflow-columns/:id', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'WorkflowColumnsNeedAnAdmin' }, 403)
    }
    const draft = updateDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidWorkflowColumn', issues: draft.error.issues }, 422)
    }
    const column = columns.update(Number(context.req.param('id')), draft.data)
    return context.json({ column })
  })

  api.delete('/api/settings/workflow-columns/:id', (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'WorkflowColumnsNeedAnAdmin' }, 403)
    }
    columns.remove(Number(context.req.param('id')))
    return context.json({ columns: columns.list() })
  })

  api.put('/api/settings/workflow-columns-order', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'WorkflowColumnsNeedAnAdmin' }, 403)
    }
    const body = reorderSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidWorkflowColumnOrder', issues: body.error.issues }, 422)
    }
    return context.json({ columns: columns.reorder(body.data.keysInOrder) })
  })

  return api
}
