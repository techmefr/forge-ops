import { Hono } from 'hono'
import { z } from 'zod'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { CriterionRepository } from './CriterionRepository.js'

const identifierSchema = z.coerce.number().int().positive()

const criterionDraftSchema = z.object({
  reference: z.string().min(1),
  statement: z.string().min(1),
  persona: z.string().nullish(),
  expectsRefusal: z.boolean().optional(),
})

const criterionProofSchema = z.object({ evidencePath: z.string() })

export type CriterionApiInput = {
  criteria: CriterionRepository
}

export function createCriterionApi({ criteria }: CriterionApiInput): Hono {
  const api = new Hono()

  api.onError(mapApiError)

  api.post('/api/stories/:id/criteria', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const draft = criterionDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidCriterionDraft', issues: draft.error.issues }, 422)
    }
    return context.json(criteria.declareCriterion({ storyId: storyId.data, ...draft.data }), 201)
  })

  api.post('/api/criteria/:id/satisfy', async (context) => {
    const criterionId = identifierSchema.safeParse(context.req.param('id'))
    if (!criterionId.success) {
      return context.json({ error: 'InvalidCriterionIdentifier' }, 422)
    }
    const body = criterionProofSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidCriterionProof', issues: body.error.issues }, 422)
    }
    return context.json(criteria.satisfyCriterion(criterionId.data, body.data.evidencePath))
  })

  return api
}
