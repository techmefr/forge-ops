import { Hono } from 'hono'
import { z } from 'zod'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { StoryNotFoundError, StoryViolationError } from '../Story/StoryViolation.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import { CHECKPOINT_SEQUENCE, REVIEW_LENS_SEQUENCE } from '../Checkpoint/Checkpoint.js'
import { CheckpointViolationError } from '../Checkpoint/CheckpointViolation.js'
import type { ZoneRepository } from '../Zone/ZoneRepository.js'
import { ZoneNotFoundError, ZoneViolationError } from '../Zone/ZoneViolation.js'
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

export type BoardApiInput = {
  repository: StoryRepository
  agentSessions: AgentSessionRepository
  checkpoints: CheckpointRepository
  zones: ZoneRepository
  claudeHome: string
}

export function createBoardApi({ repository, agentSessions, checkpoints, zones, claudeHome }: BoardApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof StoryNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (error instanceof ZoneNotFoundError) {
      return context.json({ error: error.name, message: error.message }, 404)
    }
    if (
      error instanceof StoryViolationError ||
      error instanceof CheckpointViolationError ||
      error instanceof ZoneViolationError
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
    return context.json(repository.writeStory(draft.data), 201)
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
    return context.json(checkpoints.proveCheckpoint({ storyId: storyId.data, ...draft.data }), 201)
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

  api.get('/api/board/columns', (context) => context.json(KANBAN_COLUMNS))

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
