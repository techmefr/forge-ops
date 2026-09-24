import { Hono } from 'hono'
import { z } from 'zod'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { ForgeCardRepository } from './ForgeCardRepository.js'

const draftSchema = z.object({
  storyIds: z.array(z.number().int().positive()),
})

export type ForgeCardApiInput = {
  forgeCards: ForgeCardRepository
}

export function createForgeCardApi({ forgeCards }: ForgeCardApiInput): Hono {
  const api = new Hono()

  api.onError(mapApiError)

  api.post('/api/forge-cards', async (context) => {
    const draft = draftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidForgeCardDraft', issues: draft.error.issues }, 422)
    }
    const card = forgeCards.createForgeCard(draft.data)
    return context.json(card, 201)
  })

  return api
}
