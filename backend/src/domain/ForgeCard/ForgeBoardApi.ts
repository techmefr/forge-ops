import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { mapApiError } from '../Board/ApiErrorMap.js'
import { assertHandOf } from '../Story/StoryHand.js'
import type { ForgeCardMoved } from '../../../../contract/ForgeCardContract.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { ForgeBoardRepository } from './ForgeBoardRepository.js'
import type { ForgeCardCloser } from './ForgeCardCloser.js'
import type { ForgeCardMover } from './ForgeCardMover.js'
import type { ForgeCardRepository } from './ForgeCardRepository.js'

const identifierSchema = z.coerce.number().int().positive()

const moveSchema = z.object({ stepKey: z.string().trim().min(1).max(80) }).strict()

const backlogSchema = z
  .object({
    subjectId: z.number().int().positive(),
    title: z.string().trim().min(1).max(200),
  })
  .strict()

export type ForgeBoardApiInput = {
  board: ForgeBoardRepository
  mover: ForgeCardMover
  closer: ForgeCardCloser
  forgeCards: ForgeCardRepository
  stories: StoryRepository
  events: Pick<EventBus, 'publish'>
  autopilot?: {
    reset: (forgeCardId: number) => void
    suspend: (forgeCardId: number) => () => void
    resume: (forgeCardId: number) => Promise<boolean>
  }
}

export function createForgeBoardApi({
  board,
  mover,
  closer,
  forgeCards,
  stories,
  events,
  autopilot,
}: ForgeBoardApiInput): Hono {
  const api = new Hono()

  api.onError(mapApiError)

  function assertHand(context: Context, subjectId: number, reference: string): void {
    assertHandOf(context, reference, stories.assigneeOf(subjectId))
  }

  function announce(moved: ForgeCardMoved): void {
    if (!moved.started || moved.claudeSessionId === null) {
      return
    }
    events.publish({
      name: 'session.dispatched',
      payload: {
        storyId: moved.card.storyId,
        reference: moved.card.storyReference,
        claudeSessionId: moved.claudeSessionId,
      },
    })
  }

  api.get('/api/forge-cards', (context) => {
    const project = identifierSchema.safeParse(context.req.query('project'))
    if (!project.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    if (stories.projects.find(project.data) === null) {
      return context.json({ error: 'ProjectNotFound' }, 404)
    }
    return context.json(board.list(project.data))
  })

  api.post('/api/forge-cards/backlog', async (context) => {
    const draft = backlogSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidBacklogStory', issues: draft.error.issues }, 422)
    }
    const epic = stories.findEpic(draft.data.subjectId)
    assertHand(context, epic.id, epic.title)
    const story = stories.writeStory({ epicId: epic.id, title: draft.data.title, body: draft.data.title })
    stories.writeTwin({ storyId: story.id, title: `Tests: ${draft.data.title}`, body: draft.data.title })
    stories.sendToBacklog(story.id)
    const card = forgeCards.attachCardToStory(story.id)
    return context.json(board.view(card.id), 201)
  })

  api.post('/api/forge-cards/:id/move', async (context) => {
    const forgeCardId = identifierSchema.safeParse(context.req.param('id'))
    if (!forgeCardId.success) {
      return context.json({ error: 'InvalidForgeCardIdentifier' }, 422)
    }
    const order = moveSchema.safeParse(await context.req.json().catch(() => null))
    if (!order.success) {
      return context.json({ error: 'InvalidMoveOrder', issues: order.error.issues }, 422)
    }
    const current = board.view(forgeCardId.data)
    assertHand(context, current.subjectId, current.reference)
    const restore = autopilot?.suspend(forgeCardId.data)
    try {
      const moved = await mover.move(forgeCardId.data, order.data.stepKey)
      announce(moved)
      return context.json(moved)
    } catch (error) {
      restore?.()
      throw error
    }
  })

  api.post('/api/forge-cards/:id/done', (context) => {
    const forgeCardId = identifierSchema.safeParse(context.req.param('id'))
    if (!forgeCardId.success) {
      return context.json({ error: 'InvalidForgeCardIdentifier' }, 422)
    }
    const current = board.view(forgeCardId.data)
    assertHand(context, current.subjectId, current.reference)
    const closed = closer.close(forgeCardId.data)
    autopilot?.reset(forgeCardId.data)
    for (const story of closed.unblocked) {
      events.publish({ name: 'story.unblocked', payload: { ...story } })
    }
    events.publish({ name: 'story.merged', payload: { storyId: current.storyId, ...closed.cleanUp } })
    return context.json(closed)
  })

  api.post('/api/forge-cards/:id/launch', async (context) => {
    const forgeCardId = identifierSchema.safeParse(context.req.param('id'))
    if (!forgeCardId.success) {
      return context.json({ error: 'InvalidForgeCardIdentifier' }, 422)
    }
    const current = board.view(forgeCardId.data)
    assertHand(context, current.subjectId, current.reference)
    if ((await autopilot?.resume(forgeCardId.data)) === true) {
      return context.json({ card: board.view(forgeCardId.data), started: false, claudeSessionId: null }, 201)
    }
    const restore = autopilot?.suspend(forgeCardId.data)
    try {
      const moved = await mover.launch(forgeCardId.data)
      announce(moved)
      return context.json(moved, 201)
    } catch (error) {
      restore?.()
      throw error
    }
  })

  return api
}
