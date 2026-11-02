import type { Hono } from 'hono'
import { z } from 'zod'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import { parseBody } from '../../technical/Http/ParseBody.js'
import { AGENT_PHASE_SEQUENCE } from '../Agent/AgentSession.js'
import { assertDoneEarned } from './DoneGate.js'
import { assertHandOf } from './StoryHand.js'
import {
  STEP_BACK_TARGETS,
  assertHumanHand,
  assertStepBack,
  assertStepBackReason,
  checkpointsAheadOf,
} from './StepBack.js'
import { identifierSchema, type StoryApiInput } from './StoryRouteSupport.js'

const stepBackSchema = z.object({
  state: z.enum(STEP_BACK_TARGETS),
  reason: z.string(),
  claudeSessionId: z.string().nullish(),
  agentName: z.string().nullish(),
})

const doneSchema = z.object({
  claudeSessionId: z.string().nullish(),
  agentName: z.string().nullish(),
})

const dispatchSchema = z.object({
  phase: z.enum(AGENT_PHASE_SEQUENCE),
  columnId: z.number().int().positive().optional(),
})

type ClosureDeps = Omit<StoryApiInput, 'agentSessions'>

export function mountStoryClosureRoutes(api: Hono, deps: ClosureDeps): void {
  mountDoneRoute(api, deps)
  mountStepBackRoute(api, deps)
  mountDispatchRoute(api, deps)
}

function mountDoneRoute(
  api: Hono,
  { repository, checkpoints, criteria, events, cleanUpAfterMerge }: ClosureDeps,
): void {
  api.post('/api/stories/:id/done', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const hand = doneSchema.safeParse(await context.req.json().catch(() => ({})))
    if (!hand.success) {
      return context.json({ error: 'InvalidDoneRequest', issues: hand.error.issues }, 422)
    }
    assertHumanHand(hand.data, 'Clore une story et effacer son worktree')
    const story = repository.findStory(storyId.data)
    assertHandOf(context, story.reference, repository.assigneeOf(story.epicId))
    assertDoneEarned(story.reference, {
      state: story.state,
      definitionOfDone: checkpoints.definitionOfDone(story.id),
      cascade: checkpoints.reviewCascade(story.id),
      unresolvedFindings: checkpoints.listUnresolvedFindings(story.id),
      businessIntent: repository.findEpic(story.epicId).businessIntent,
      criteria: criteria.listCriteria(story.id),
    })
    const unblocked = repository.markDoneAndUnblock(storyId.data)
    for (const story of unblocked) {
      events.publish({ name: 'story.unblocked', payload: { ...story } })
    }
    const cleanUp = cleanUpAfterMerge(storyId.data)
    events.publish({ name: 'story.merged', payload: { storyId: storyId.data, ...cleanUp } })
    return context.json({ story: repository.findStory(storyId.data), unblocked, cleanUp })
  })
}

function mountStepBackRoute(api: Hono, { repository, checkpoints, events }: ClosureDeps): void {
  api.post('/api/stories/:id/step-back', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = await parseBody(context, stepBackSchema)
    if (!body.success) {
      return context.json({ error: 'InvalidStepBack', issues: body.error.issues }, 422)
    }
    assertHumanHand(body.data, 'Reculer une story')
    const story = repository.findStory(storyId.data)
    const reason = assertStepBackReason(story.reference, body.data.reason)
    assertStepBack(story.reference, story.state, body.data.state)
    const revokedCheckpoints = checkpoints.revokeCheckpoints(
      story.id,
      checkpointsAheadOf(body.data.state),
    )
    const stepBack = repository.stepBack({
      storyId: story.id,
      toState: body.data.state,
      reason,
      askedBy: operatorOf(context),
      revokedCheckpoints,
    })
    events.publish({
      name: 'story.stepped_back',
      payload: { reference: story.reference, ...stepBack },
    })
    events.publish({
      name: 'story.moved',
      payload: { storyId: story.id, state: stepBack.toState },
    })
    return context.json({ story: repository.findStory(story.id), stepBack })
  })
}

function mountDispatchRoute(api: Hono, { events, dispatcher }: ClosureDeps): void {
  api.post('/api/stories/:id/dispatch', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = await parseBody(context, dispatchSchema)
    if (!body.success) {
      return context.json({ error: 'InvalidDispatchOrder', issues: body.error.issues }, 422)
    }
    const dispatched = await dispatcher.dispatch({
      storyId: storyId.data,
      phase: body.data.phase,
      ...(body.data.columnId === undefined ? {} : { columnId: body.data.columnId }),
    })
    events.publish({
      name: 'session.dispatched',
      payload: {
        storyId: dispatched.storyId,
        phase: dispatched.phase,
        agentName: dispatched.agentName,
        claudeSessionId: dispatched.claudeSessionId,
      },
    })
    return context.json(dispatched, 201)
  })
}
