import { Hono } from 'hono'
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
}

export function createBudgetApi({ budget, events }: BudgetApiInput): Hono {
  const api = new Hono()

  api.onError(mapApiError)

  api.get('/api/settings/budget', (context) =>
    context.json({ policy: budget.readPolicy(), spentUsd: budget.spentToday() }),
  )

  api.put('/api/settings/budget', async (context) => {
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
