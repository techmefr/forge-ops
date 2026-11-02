import type { Context } from 'hono'
import { z } from 'zod'
import { workflowDraftSchema } from '../../../../contract/WorkflowContract.js'
import { mapApiError } from '../Board/ApiErrorMap.js'
import { WorkflowInUseError, WorkflowNotFoundError, WorkflowRefusedError } from './ProjectWorkflowViolation.js'
import { parseBody } from '../../technical/Http/ParseBody.js'

export const identifierSchema = z.coerce.number().int().positive()

export function mapProjectWorkflowError(error: Error, context: Context): Response | Promise<Response> {
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
}

export function createProjectWorkflowGuards(
  projectExists: (projectId: number) => boolean,
  mayAdminister: (projectId: number, context: Context) => boolean,
) {
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
    const draft = await parseBody(context, workflowDraftSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidWorkflow', issues: draft.error.issues }, 422)
    }
    return draft.data
  }

  function workflowIdOf(context: Context): number | Response {
    const parsed = identifierSchema.safeParse(context.req.param('workflowId'))
    return parsed.success ? parsed.data : context.json({ error: 'InvalidWorkflowIdentifier' }, 422)
  }

  return { guard, draftOf, workflowIdOf }
}
