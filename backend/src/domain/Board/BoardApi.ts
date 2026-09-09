import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { StoryNotFoundError, StoryViolationError } from '../Story/StoryViolation.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import { CHECKPOINT_SEQUENCE, REVIEW_LENS_SEQUENCE } from '../Checkpoint/Checkpoint.js'
import { CheckpointViolationError } from '../Checkpoint/CheckpointViolation.js'
import type { ZoneRepository } from '../Zone/ZoneRepository.js'
import { ZoneNotFoundError, ZoneViolationError } from '../Zone/ZoneViolation.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import { CriterionNotFoundError, CriterionViolationError } from '../Criterion/CriterionViolation.js'
import type { Dispatcher } from '../Dispatch/Dispatcher.js'
import { DispatchViolationError } from '../Dispatch/DispatchViolation.js'
import { PHASE_CONTRACTS } from '../Dispatch/Dispatch.js'
import { EvidencePathRefusedError } from '../Evidence/EvidencePath.js'
import { KANBAN_COLUMNS } from '../Story/Story.js'
import { readJobStates, readRoster } from '../../technical/ClaudeCode/JobStateReader.js'

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
  events: EventBus
  dispatcher: Dispatcher
  claudeHome: string
}

export function createBoardApi({
  repository,
  agentSessions,
  checkpoints,
  criteria,
  zones,
  events,
  dispatcher,
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
    if (error instanceof StoryNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof ZoneNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof CriterionNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (
      error instanceof StoryViolationError ||
      error instanceof CheckpointViolationError ||
      error instanceof ZoneViolationError ||
      error instanceof CriterionViolationError ||
      error instanceof DispatchViolationError ||
      error instanceof EvidencePathRefusedError
    ) {
      return context.json({ error: error.name, message: error.message }, 409)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
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
    return context.json(checkpoint, 201)
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

  api.post('/api/stories/:id/review/:lens/pass', (context) => {
    const storyId = identifierSchema.safeParse(context.req.param('id'))
    if (!storyId.success) {
      return context.json({ error: 'InvalidStoryIdentifier' }, 422)
    }
    const lens = z.enum(REVIEW_LENS_SEQUENCE).safeParse(context.req.param('lens'))
    if (!lens.success) {
      return context.json({ error: 'InvalidReviewLens' }, 422)
    }
    return context.json(checkpoints.passLens(storyId.data, lens.data))
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
