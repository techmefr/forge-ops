import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { AGENT_PHASE_SEQUENCE } from '../../../../contract/AgentContract.js'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { WorkflowRepository } from './WorkflowRepository.js'
import { WorkflowRefusedError } from './WorkflowViolation.js'

const phaseEntrySchema = z.object({
  phase: z.enum(AGENT_PHASE_SEQUENCE),
  agentName: z.string().min(1),
  command: z.string().min(1),
  preprompt: z.string(),
})

const phasesSchema = z.array(phaseEntrySchema).min(1)

export type WorkflowApiInput = {
  workflow: WorkflowRepository
  maySettle: (context: Context) => boolean
}

export function createWorkflowApi({ workflow, maySettle }: WorkflowApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof WorkflowRefusedError) {
      return context.json({ error: 'WorkflowRefused', refusal: error.refusal }, 422)
    }
    return mapApiError(error, context)
  })

  api.get('/api/settings/workflow', (context) =>
    context.json({ phases: workflow.readPhases(), maySettle: maySettle(context) }),
  )

  api.put('/api/settings/workflow', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'WorkflowNeedsAnAdmin' }, 403)
    }
    const phases = phasesSchema.safeParse(await context.req.json().catch(() => null))
    if (!phases.success) {
      return context.json({ error: 'InvalidWorkflow', issues: phases.error.issues }, 422)
    }
    return context.json({ phases: workflow.writePhases(phases.data) })
  })

  return api
}
