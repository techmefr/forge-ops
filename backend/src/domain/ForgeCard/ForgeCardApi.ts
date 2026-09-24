import { Hono } from 'hono'
import { z } from 'zod'
import { mapApiError } from '../Board/ApiErrorMap.js'
import type { ForgeCardRepository } from './ForgeCardRepository.js'
import type { WorktreeRepository } from '../Worktree/WorktreeRepository.js'

const draftSchema = z.object({
  storyIds: z.array(z.number().int().positive()),
})

const identifierSchema = z.coerce.number().int().positive()

const worktreeOrderSchema = z.object({
  baseRef: z.string().min(1).max(200).default('HEAD'),
})

export type ForgeCardApiInput = {
  forgeCards: ForgeCardRepository
  worktrees: WorktreeRepository
}

export function createForgeCardApi({ forgeCards, worktrees }: ForgeCardApiInput): Hono {
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

  api.post('/api/forge-cards/:id/worktree', async (context) => {
    const forgeCardId = identifierSchema.safeParse(context.req.param('id'))
    if (!forgeCardId.success) {
      return context.json({ error: 'InvalidForgeCardIdentifier' }, 422)
    }
    const order = worktreeOrderSchema.safeParse((await context.req.json().catch(() => null)) ?? {})
    if (!order.success) {
      return context.json({ error: 'InvalidWorktreeOrder', issues: order.error.issues }, 422)
    }
    const card = forgeCards.findForgeCard(forgeCardId.data)
    const [storyId] = card.storyIds
    if (storyId === undefined) {
      throw new RangeError(`forge card ${card.reference} porte aucune story`)
    }
    const opened = worktrees.open({ storyId, forgeCardId: card.id, baseRef: order.data.baseRef })
    return context.json(opened, 201)
  })

  return api
}
