import type { Context } from 'hono'
import { z } from 'zod'
import { mapApiError } from '../Board/ApiErrorMap.js'
import { WorkflowNotFoundError } from './ProjectWorkflowViolation.js'
import {
  WorkflowColumnInUseError,
  WorkflowColumnNotFoundError,
  WorkflowColumnRefusedError,
} from './WorkflowColumnViolation.js'

export const identifierSchema = z.coerce.number().int().positive()

const optionalIdentifierSchema = identifierSchema.optional()

export function mapWorkflowColumnError(error: Error, context: Context): Response | Promise<Response> {
  if (error instanceof WorkflowColumnRefusedError) {
    return context.json({ error: 'WorkflowColumnRefused', message: error.refusal.reason, refusal: error.refusal }, 422)
  }
  if (error instanceof WorkflowColumnNotFoundError || error instanceof WorkflowNotFoundError) {
    return context.json({ error: error.name, message: error.message }, 404)
  }
  if (error instanceof WorkflowColumnInUseError) {
    return context.json({ error: error.name, message: error.message, stories: error.stories }, 409)
  }
  return mapApiError(error, context)
}

export function createWorkflowColumnGuards(
  projectExists: (projectId: number) => boolean,
  mayAdminister: (projectId: number, context: Context) => boolean,
) {
  function workflowOf(context: Context): number | undefined | Response {
    const parsed = optionalIdentifierSchema.safeParse(context.req.query('workflow'))
    if (!parsed.success) {
      return context.json({ error: 'InvalidWorkflowIdentifier' }, 422)
    }
    return parsed.data
  }

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

  function guardScoped(context: Context, admin: boolean): { projectId: number; workflowId: number | undefined } | Response {
    const guarded = admin ? guardAdmin(context) : guard(context)
    if (guarded instanceof Response) {
      return guarded
    }
    const workflowId = workflowOf(context)
    if (workflowId instanceof Response) {
      return workflowId
    }
    return { projectId: guarded.projectId, workflowId }
  }

  return { workflowOf, guard, guardAdmin, guardScoped }
}
