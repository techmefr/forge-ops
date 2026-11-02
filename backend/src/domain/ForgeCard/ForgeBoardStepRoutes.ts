import type { Hono } from 'hono'
import { parseBody } from '../../technical/Http/ParseBody.js'
import {
  createForgeBoardSupport,
  identifierSchema,
  launchSchema,
  moveSchema,
  type ForgeBoardApiInput,
} from './ForgeBoardApiSupport.js'

export function mountForgeBoardStepRoutes(
  api: Hono,
  { board, mover, closer, stories, events, autopilot }: ForgeBoardApiInput,
): void {
  const { assertHand, announce } = createForgeBoardSupport({ stories, events })

  api.post('/api/forge-cards/:id/move', async (context) => {
    const forgeCardId = identifierSchema.safeParse(context.req.param('id'))
    if (!forgeCardId.success) {
      return context.json({ error: 'InvalidForgeCardIdentifier' }, 422)
    }
    const order = await parseBody(context, moveSchema)
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
    const order = launchSchema.safeParse(await context.req.json().catch(() => ({})))
    if (!order.success) {
      return context.json({ error: 'InvalidLaunchOrder', issues: order.error.issues }, 422)
    }
    const current = board.view(forgeCardId.data)
    assertHand(context, current.subjectId, current.reference)
    const feedback = order.data.feedback
    if (feedback === undefined && (await autopilot?.resume(forgeCardId.data)) === true) {
      return context.json({ card: board.view(forgeCardId.data), started: false, claudeSessionId: null }, 201)
    }
    const restore = autopilot?.suspend(forgeCardId.data)
    try {
      const moved = await mover.launch(forgeCardId.data, feedback === undefined ? {} : { feedback })
      announce(moved)
      return context.json(moved, 201)
    } catch (error) {
      restore?.()
      throw error
    }
  })
}
