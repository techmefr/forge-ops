import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { BudgetRepository } from './BudgetRepository.js'

const budgetPolicySchema = z.object({
  capUsd: z.number().positive(),
  conduct: z.enum(['stop', 'downgrade', 'reroute']),
  downgradeModel: z.string(),
  rerouteBaseUrl: z.string().nullable(),
})

export type BudgetApiInput = {
  budget: BudgetRepository
  events: EventBus
  maySettle: (context: Context) => boolean
}

export function createBudgetApi({ budget, events, maySettle }: BudgetApiInput): Hono {
  const api = new Hono()

  api.onError(mapApiError)

  api.get('/api/settings/budget', (context) =>
    context.json({
      policy: budget.readPolicy(),
      spentUsd: budget.spentToday(),
      maySettle: maySettle(context),
    }),
  )

  api.put('/api/settings/budget', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'BudgetNeedsAnAdmin' }, 403)
    }
    const policy = budgetPolicySchema.safeParse(await context.req.json().catch(() => null))
    if (!policy.success) {
      return context.json({ error: 'InvalidBudgetPolicy', issues: policy.error.issues }, 422)
    }
    const written = budget.writePolicy(policy.data)
    events.publish({ name: 'budget.policy.written', payload: { ...written } })
    return context.json(written)
  })

  return api
}
