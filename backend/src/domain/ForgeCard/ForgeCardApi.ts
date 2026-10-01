import { Hono } from 'hono'
import { z } from 'zod'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import { mapApiError } from '../Board/ApiErrorMap.js'
import { assertStoryHand } from '../Story/StoryHand.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { baseRefSchema } from '../Worktree/Worktree.js'
import type { ForgeCardRepository } from './ForgeCardRepository.js'
import type { WorktreeRepository } from '../Worktree/WorktreeRepository.js'

const identifierSchema = z.coerce.number().int().positive()

const worktreeOrderSchema = z.object({
  baseRef: baseRefSchema,
})

export type ForgeCardApiInput = {
  forgeCards: ForgeCardRepository
  worktrees: WorktreeRepository
  stories: StoryRepository
}

export function createForgeCardApi({ forgeCards, worktrees, stories }: ForgeCardApiInput): Hono {
  const api = new Hono()

  api.onError(mapApiError)

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
    const story = stories.findStory(storyId)
    assertStoryHand(story.reference, stories.assigneeOf(story.epicId), operatorOf(context))
    const opened = worktrees.open({ storyId, forgeCardId: card.id, baseRef: order.data.baseRef })
    return context.json(opened, 201)
  })

  return api
}
