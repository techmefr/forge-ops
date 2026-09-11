import { Hono } from 'hono'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { Ticket } from '../../../../contract/BoardContract.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import { AGENT_PHASE_SEQUENCE } from '../Agent/AgentSession.js'
import { mapApiError } from '../Board/ApiErrorMap.js'
import { buildStoryReport } from '../Board/StoryReport.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import type { MergeCleanupReport } from '../Deployment/MergeCleanup.js'
import type { Dispatcher } from '../Dispatch/Dispatcher.js'
import { scoreCompleteness } from './Completeness.js'
import { assertDoneEarned } from './DoneGate.js'
import { assertStoryHand } from './StoryHand.js'
import {
  STEP_BACK_TARGETS,
  assertHumanHand,
  assertStepBack,
  assertStepBackReason,
  checkpointsAheadOf,
} from './StepBack.js'
import type { StoryRepository } from './StoryRepository.js'

const identifierSchema = z.coerce.number().int().positive()

const cardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
})

const storyDraftSchema = z.object({
  epicId: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1),
})

const twinDraftSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
})

const dependencySchema = z.object({ blockingStoryId: z.number().int().positive() })

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

const estimateSchema = z.object({ points: z.number() })

const rolloutSchema = z.object({ percent: z.number() })

const dispatchSchema = z.object({
  phase: z.enum(AGENT_PHASE_SEQUENCE),
})

export type StoryApiInput = {
  repository: StoryRepository
  agentSessions: AgentSessionRepository
  checkpoints: CheckpointRepository
  criteria: CriterionRepository
  events: EventBus
  dispatcher: Dispatcher
  cleanUpAfterMerge: (storyId: number) => MergeCleanupReport
}

export function createStoryApi({
  repository,
  agentSessions,
  checkpoints,
  criteria,
  events,
  dispatcher,
  cleanUpAfterMerge,
}: StoryApiInput): Hono {
  const api = new Hono()

  api.onError(mapApiError)

  api.post('/api/stories', async (context) => {
    const draft = storyDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidStoryDraft', issues: draft.error.issues }, 422)
    }
    const story = repository.writeStory(draft.data)
    events.publish({ name: 'story.written', payload: { ...story } })
    return context.json(story, 201)
  })

  api.put('/api/stories/:id', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const draft = cardSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidCard', issues: draft.error.issues }, 422)
    }
    const story = repository.editStory(storyId.data, draft.data)
    events.publish({ name: 'story.edited', payload: { ...story } })
    return context.json(story)
  })

  api.post('/api/stories/:id/twin', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const draft = twinDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidTwinDraft', issues: draft.error.issues }, 422)
    }
    return context.json(repository.writeTwin({ storyId: storyId.data, ...draft.data }), 201)
  })

  api.post('/api/stories/:id/backlog', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(repository.sendToBacklog(storyId.data))
  })

  api.get('/api/stories/backlog', (context) => context.json(repository.listBacklog()))

  api.post('/api/stories/:id/dependencies', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = dependencySchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidDependency', issues: body.error.issues }, 422)
    }
    repository.addDependency({
      blockedStoryId: storyId.data,
      blockingStoryId: body.data.blockingStoryId,
    })
    return context.json({ blockers: repository.listBlockers(storyId.data) }, 201)
  })

  api.get('/api/stories/:id/blockers', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    repository.findStory(storyId.data)
    return context.json({ blockers: repository.listBlockers(storyId.data) })
  })

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
    assertStoryHand(story.reference, repository.assigneeOf(story.epicId), operatorOf(context))
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

  api.post('/api/stories/:id/step-back', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = stepBackSchema.safeParse(await context.req.json().catch(() => null))
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

  api.post('/api/stories/:id/plan/accept', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const story = repository.findStory(storyId.data)
    if (story.state !== 'plan_review') {
      return context.json({ error: 'PlanNotSettled', state: story.state }, 409)
    }
    const building = repository.startBuilding(storyId.data)
    events.publish({ name: 'story.moved', payload: { storyId: building.id, state: building.state } })
    return context.json(building)
  })

  api.get('/api/stories/:id/ticket', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const asked = repository.findStory(storyId.data)
    const functional =
      asked.twinOfStoryId === null ? asked : repository.findStory(asked.twinOfStoryId)
    const ticket: Ticket = {
      functional,
      tests: repository.findTwin(functional.id),
      criteria: criteria.listCriteria(functional.id),
      dod: checkpoints.definitionOfDone(functional.id),
      cascade: checkpoints.reviewCascade(functional.id),
      blockers: repository.listBlockers(functional.id),
      stepBacks: repository.listStepBacks(functional.id),
      completeness: scoreCompleteness({
        title: functional.title,
        body: functional.body,
        criteria: criteria.listCriteria(functional.id).map((criterion) => criterion.reference),
        hasTwin: repository.findTwin(functional.id) !== null,
      }),
    }
    return context.json(ticket)
  })

  api.post('/api/stories/:id/estimate', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = estimateSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidEstimate', issues: body.error.issues }, 422)
    }
    return context.json(repository.estimate(storyId.data, body.data.points))
  })

  api.post('/api/stories/:id/rollout', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = rolloutSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidRollout', issues: body.error.issues }, 422)
    }
    return context.json(repository.rollOut(storyId.data, body.data.percent))
  })

  api.post('/api/stories/:id/merge-conflict', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(repository.markMergeConflict(storyId.data))
  })

  api.delete('/api/stories/:id/merge-conflict', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(repository.clearMergeConflict(storyId.data))
  })

  api.post('/api/stories/:id/dispatch', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = dispatchSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidDispatchOrder', issues: body.error.issues }, 422)
    }
    const dispatched = await dispatcher.dispatch({ storyId: storyId.data, phase: body.data.phase })
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

  api.get('/api/stories/:id/report', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    repository.findStory(storyId.data)
    return context.json(
      buildStoryReport({
        storyId: storyId.data,
        stories: repository,
        checkpoints,
        criteria,
        sessions: agentSessions,
      }),
    )
  })

  return api
}
