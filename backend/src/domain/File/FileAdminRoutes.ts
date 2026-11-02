import { stat } from 'node:fs/promises'
import type { Hono } from 'hono'
import { z } from 'zod'
import { parseBody } from '../../technical/Http/ParseBody.js'
import { CheckoutPathRefusedError } from '../Story/CheckoutPath.js'
import type { FileApiInput } from './FileApi.js'
import { holdsServerData, identifierSchema, outsideRoots, saidBy, type HolderResolver } from './FileHolder.js'

const checkoutSchema = z.object({ checkoutPath: z.string().min(1) })

async function isDirectory(path: string): Promise<boolean> {
  return stat(path)
    .then((found) => found.isDirectory())
    .catch(() => false)
}

type AdminInput = Pick<FileApiInput, 'stories' | 'mayAdminister' | 'installGuardrails'> & {
  serverPaths: readonly string[]
}

export function mountFileAdminRoutes(
  api: Hono,
  { holderOf }: HolderResolver,
  { stories, mayAdminister, installGuardrails, serverPaths }: AdminInput,
): void {
  api.post('/api/projects/:id/guardrails', (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    if (stories.listProjects().find((known) => known.id === projectId.data) === undefined) {
      return context.json({ error: 'ProjectNotFound' }, 404)
    }
    if (!mayAdminister(projectId.data, context)) {
      return context.json({ error: 'GuardrailsNeedAnAdmin' }, 403)
    }
    const holder = holderOf(context.req.param('id'))
    if (holder === 'unknown-project' || holder === 'unknown-checkout') {
      return context.json({ error: 'CheckoutUnknown' }, 409)
    }
    if (outsideRoots(holder)) {
      return context.json({ error: 'CheckoutPathRefused', reason: holder.refused }, 422)
    }
    if (installGuardrails === undefined) {
      return context.json({ error: 'GuardrailInstallUnavailable' }, 501)
    }
    try {
      return context.json(installGuardrails(holder.checkoutPath))
    } catch (error) {
      return context.json({ error: 'GuardrailInstallRefused', reason: saidBy(error) }, 422)
    }
  })

  api.put('/api/projects/:id/checkout', async (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    if (stories.listProjects().find((known) => known.id === projectId.data) === undefined) {
      return context.json({ error: 'ProjectNotFound' }, 404)
    }
    if (!mayAdminister(projectId.data, context)) {
      return context.json({ error: 'CheckoutNeedsAnAdmin' }, 403)
    }
    const body = await parseBody(context, checkoutSchema)
    if (!body.success) {
      return context.json({ error: 'InvalidCheckoutPath', issues: body.error.issues }, 422)
    }
    if (!(await isDirectory(body.data.checkoutPath))) {
      return context.json({ error: 'CheckoutNotADirectory' }, 422)
    }
    if (holdsServerData(body.data.checkoutPath, serverPaths)) {
      return context.json({ error: 'CheckoutPathRefused', reason: 'the checkout contains the server data' }, 422)
    }
    try {
      return context.json(stories.setCheckoutPath(projectId.data, body.data.checkoutPath))
    } catch (error) {
      if (error instanceof CheckoutPathRefusedError) {
        return context.json({ error: 'CheckoutPathRefused', reason: error.message }, 422)
      }
      throw error
    }
  })
}
