import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import {
  EpicNotFoundError,
  StoryNotFoundError,
  StoryViolationError,
} from '../Story/StoryViolation.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import { reapStaleSessions, STALE_AFTER_SECONDS } from '../Agent/Heartbeat.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import { CHECKPOINT_SEQUENCE, REVIEW_LENS_SEQUENCE } from '../Checkpoint/Checkpoint.js'
import { CheckpointViolationError } from '../Checkpoint/CheckpointViolation.js'
import { describeZone } from '../Zone/ZoneDigest.js'
import type { ZoneRepository } from '../Zone/ZoneRepository.js'
import { ZoneNotFoundError, ZoneViolationError } from '../Zone/ZoneViolation.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import { CriterionNotFoundError, CriterionViolationError } from '../Criterion/CriterionViolation.js'
import type { Dispatcher } from '../Dispatch/Dispatcher.js'
import { DispatchViolationError } from '../Dispatch/DispatchViolation.js'
import { ScopeTakenError, ScopeViolationError } from '../Foremerge/ForemergeViolation.js'
import { PHASE_CONTRACTS } from '../Dispatch/Dispatch.js'
import { EvidencePathRefusedError } from '../Evidence/EvidencePath.js'
import { EvidenceShapeRefusedError } from '../Evidence/EvidenceShape.js'
import { EvidenceUnreadableError } from '../Evidence/EvidenceRead.js'
import type { BudgetRepository } from '../Budget/BudgetRepository.js'
import { BudgetViolationError } from '../Budget/BudgetViolation.js'
import { KANBAN_COLUMNS } from '../Story/Story.js'
import { stateAfterCheckpoint } from '../Story/Advance.js'
import {
  STEP_BACK_TARGETS,
  assertHumanHand,
  assertStepBack,
  assertStepBackReason,
  checkpointsAheadOf,
} from '../Story/StepBack.js'
import { scoreCompleteness } from '../Story/Completeness.js'
import type { MergeCleanupReport } from '../Deployment/MergeCleanup.js'
import type { CascadeStep } from '../Checkpoint/ReviewCascade.js'
import { buildStoryReport } from './StoryReport.js'
import { readJobStates, readRoster } from '../../technical/ClaudeCode/JobStateReader.js'

const budgetPolicySchema = z.object({
  capUsd: z.number().positive(),
  conduct: z.enum(['stop', 'downgrade', 'reroute']),
  downgradeModel: z.string(),
  rerouteBaseUrl: z.string().nullable(),
})

const projectDraftSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  repositoryUrl: z.string().min(1),
  integrationBranch: z.string().min(1),
  colour: z.string().min(1),
})

const cardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
})

const epicDraftSchema = z.object({
  projectId: z.number().int().positive(),
  title: z.string().min(1),
  businessIntent: z.string().min(1),
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

const identifierSchema = z.coerce.number().int().positive()

const dependencySchema = z.object({ blockingStoryId: z.number().int().positive() })

const hookPayloadSchema = z.object({
  session_id: z.string().min(1),
  hook_event_name: z.string().min(1),
  tool_name: z.string().nullish(),
  tool_input: z.object({ file_path: z.string().nullish() }).passthrough().nullish(),
})

const FILE_TOUCHING_TOOLS: readonly string[] = ['Edit', 'Write', 'NotebookEdit']

const checkpointDraftSchema = z.object({
  name: z.enum(CHECKPOINT_SEQUENCE),
  evidencePath: z.string(),
})

const stepBackSchema = z.object({
  state: z.enum(STEP_BACK_TARGETS),
  reason: z.string(),
  claudeSessionId: z.string().nullish(),
  agentName: z.string().nullish(),
})

const estimateSchema = z.object({ points: z.number() })

const rolloutSchema = z.object({ percent: z.number() })

const lensSchema = z.object({
  lens: z.enum(REVIEW_LENS_SEQUENCE),
  claudeSessionId: z.string().min(1),
})

const zoneDraftSchema = z.object({
  projectId: z.number().int().positive(),
  pathPrefix: z.string().min(1),
  name: z.string().min(1),
  colour: z.string().min(1),
})

const zoneSummarySchema = z.object({ pathPrefix: z.string().min(1), summary: z.string().min(1) })

const criterionDraftSchema = z.object({
  reference: z.string().min(1),
  statement: z.string().min(1),
  persona: z.string().nullish(),
  expectsRefusal: z.boolean().optional(),
})

const criterionProofSchema = z.object({ evidencePath: z.string() })

const dispatchSchema = z.object({
  phase: z.enum(['spec', 'architecture', 'tdd', 'code', 'gate', 'review', 'ship']),
})

export type BoardApiInput = {
  repository: StoryRepository
  agentSessions: AgentSessionRepository
  checkpoints: CheckpointRepository
  criteria: CriterionRepository
  zones: ZoneRepository
  budget: BudgetRepository
  events: EventBus
  dispatcher: Dispatcher
  cleanUpAfterMerge: (storyId: number) => MergeCleanupReport
  advanceReviewCascade: (storyId: number) => Promise<CascadeStep>
  claudeHome: string
}

export function createBoardApi({
  repository,
  agentSessions,
  checkpoints,
  criteria,
  zones,
  budget,
  events,
  dispatcher,
  cleanUpAfterMerge,
  advanceReviewCascade,
  claudeHome,
}: BoardApiInput): Hono {
  const api = new Hono()

  api.get('/api/events', (context) =>
    streamSSE(context, async (stream) => {
      const frames: Promise<void>[] = []
      const unsubscribe = events.subscribe((event) => {
        frames.push(stream.writeSSE({ event: event.name, data: JSON.stringify(event.payload) }))
      })
      stream.onAbort(unsubscribe)
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          unsubscribe()
          resolve()
        })
      })
      await Promise.allSettled(frames)
    }),
  )

  api.onError((error, context) => {
    if (error instanceof StoryNotFoundError || error instanceof EpicNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof ZoneNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof CriterionNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof ScopeTakenError) {
      return context.json({ error: error.name, message: error.message, heldBy: error.heldBy }, 409)
    }
    if (
      error instanceof ScopeViolationError ||
      error instanceof StoryViolationError ||
      error instanceof CheckpointViolationError ||
      error instanceof ZoneViolationError ||
      error instanceof CriterionViolationError ||
      error instanceof DispatchViolationError ||
      error instanceof BudgetViolationError ||
      error instanceof EvidencePathRefusedError ||
      error instanceof EvidenceShapeRefusedError ||
      error instanceof EvidenceUnreadableError
    ) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

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

  api.post('/api/projects', async (context) => {
    const draft = projectDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidProjectDraft', issues: draft.error.issues }, 422)
    }
    const project = repository.createProject(draft.data)
    events.publish({ name: 'project.created', payload: { ...project } })
    return context.json(project, 201)
  })

  api.get('/api/projects', (context) => context.json(repository.listProjects()))

  api.post('/api/epics', async (context) => {
    const draft = epicDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidEpicDraft', issues: draft.error.issues }, 422)
    }
    const epic = repository.createEpic(draft.data)
    events.publish({ name: 'epic.created', payload: { ...epic } })
    return context.json(epic, 201)
  })

  api.get('/api/board/self', (context) => context.json({ login: operatorOf(context) }))

  api.post('/api/epics/:id/claim', (context) => {
    const epicId = identifierSchema.safeParse(context.req.param('id'))
    if (!epicId.success) {
      return context.json({ error: 'InvalidEpicIdentifier' }, 422)
    }
    repository.claimEpic(epicId.data, operatorOf(context))
    return context.json({ claimed: true })
  })

  api.delete('/api/epics/:id/claim', (context) => {
    const epicId = identifierSchema.safeParse(context.req.param('id'))
    if (!epicId.success) {
      return context.json({ error: 'InvalidEpicIdentifier' }, 422)
    }
    repository.releaseEpic(epicId.data, operatorOf(context))
    return context.json({ released: true })
  })

  api.get('/api/projects/:id/epics', (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    return context.json(repository.listEpics(projectId.data))
  })

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
    repository.addDependency({ blockedStoryId: storyId.data, blockingStoryId: body.data.blockingStoryId })
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

  api.post('/api/stories/:id/done', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    repository.findStory(storyId.data)
    const unblocked = repository.markDoneAndUnblock(storyId.data)
    for (const story of unblocked) {
      events.publish({ name: 'story.unblocked', payload: { ...story } })
    }
    const cleanUp = cleanUpAfterMerge(storyId.data)
    events.publish({ name: 'story.merged', payload: { storyId: storyId.data, ...cleanUp } })
    return context.json({ story: repository.findStory(storyId.data), unblocked, cleanUp })
  })

  api.post('/api/stories/:id/checkpoints', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const draft = checkpointDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidCheckpointDraft', issues: draft.error.issues }, 422)
    }
    const checkpoint = checkpoints.proveCheckpoint({ storyId: storyId.data, ...draft.data })
    events.publish({ name: 'checkpoint.proven', payload: { ...checkpoint } })
    const moved = stateAfterCheckpoint(draft.data.name)
    if (moved !== null) {
      const story = repository.moveToState(storyId.data, moved)
      events.publish({ name: 'story.moved', payload: { storyId: story.id, state: story.state } })
    }
    if (draft.data.name !== 'verified') {
      return context.json(checkpoint, 201)
    }
    const cascade = await advanceReviewCascade(storyId.data)
    events.publish({ name: 'review.cascade', payload: { storyId: storyId.data, ...cascade } })
    return context.json({ ...checkpoint, cascade }, 201)
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
    assertHumanHand(body.data)
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
    return context.json({
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
    })
  })

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

  api.get('/api/stories/:id/dod', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(checkpoints.definitionOfDone(storyId.data))
  })

  api.post('/api/hooks', async (context) => {
    const payload = hookPayloadSchema.safeParse(await context.req.json().catch(() => null))
    if (!payload.success) {
      return context.json({ error: 'InvalidHookPayload', issues: payload.error.issues }, 422)
    }

    const hook = payload.data
    if (agentSessions.findByClaudeSessionId(hook.session_id) !== null) {
      agentSessions.recordHeartbeat(hook.session_id)
    }
    const path = hook.tool_input?.file_path
    const touchesAFile =
      hook.hook_event_name === 'PostToolUse' &&
      hook.tool_name !== null &&
      hook.tool_name !== undefined &&
      FILE_TOUCHING_TOOLS.includes(hook.tool_name) &&
      path !== null &&
      path !== undefined
    if (!touchesAFile) {
      return context.json({ recorded: false }, 202)
    }

    if (agentSessions.findByClaudeSessionId(hook.session_id) === null) {
      return context.json({ recorded: false }, 202)
    }

    agentSessions.recordFileTouch({ claudeSessionId: hook.session_id, path })
    const zone = zones.zoneOfPath(path)
    if (zone !== null) {
      zones.summariseZone(zone.pathPrefix, describeZone(zones.overviewOfZone(zone.pathPrefix)))
    }
    return context.json({ recorded: true }, 202)
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

  api.get('/api/stories/:id/review', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    return context.json(checkpoints.reviewCascade(storyId.data))
  })

  api.post('/api/stories/:id/review', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const body = lensSchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidReviewPass', issues: body.error.issues }, 422)
    }
    return context.json(
      checkpoints.startLens(storyId.data, body.data.lens, body.data.claudeSessionId),
      201,
    )
  })

  api.post('/api/stories/:id/review/:lens/pass', async (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const lens = z.enum(REVIEW_LENS_SEQUENCE).safeParse(context.req.param('lens'))
    if (!lens.success) {
      return context.json({ error: 'InvalidReviewLens' }, 422)
    }
    const passed = checkpoints.passLens(storyId.data, lens.data)
    const cascade = await advanceReviewCascade(storyId.data)
    events.publish({ name: 'review.cascade', payload: { storyId: storyId.data, ...cascade } })
    return context.json({ ...passed, cascade })
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

  api.get('/api/sessions/stale', (context) =>
    context.json({
      staleAfterSeconds: STALE_AFTER_SECONDS,
      sessions: agentSessions.listStaleSessions(),
    }),
  )

  api.get('/api/board/kanban', (context) => {
    reapStaleSessions({ sessions: agentSessions, stories: repository })
    return context.json(
      repository.listKanban().map((story) => ({
        ...story,
        usage: agentSessions.sumUsage(story.id),
        blockers: repository.listBlockers(story.id),
      })),
    )
  })

  api.get('/api/board/columns', (context) => context.json(KANBAN_COLUMNS))

  api.get('/api/board/phases', (context) => context.json(PHASE_CONTRACTS))

  api.post('/api/zones', async (context) => {
    const draft = zoneDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidZoneDraft', issues: draft.error.issues }, 422)
    }
    return context.json(zones.declareZone(draft.data), 201)
  })

  api.post('/api/zones/summary', async (context) => {
    const body = zoneSummarySchema.safeParse(await context.req.json().catch(() => null))
    if (!body.success) {
      return context.json({ error: 'InvalidZoneSummary', issues: body.error.issues }, 422)
    }
    return context.json(zones.summariseZone(body.data.pathPrefix, body.data.summary))
  })

  api.get('/api/projects/:id/zones', (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    return context.json(zones.overview(projectId.data))
  })

  api.get('/api/files/conflicts', (context) => context.json(agentSessions.listConflictingPaths()))

  api.get('/api/fleet', (context) =>
    context.json({
      roster: readRoster(claudeHome),
      jobs: readJobStates(claudeHome),
    }),
  )

  return api
}
