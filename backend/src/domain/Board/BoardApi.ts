import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import { reapStaleSessions, STALE_AFTER_SECONDS } from '../Agent/Heartbeat.js'
import { isWriteTool } from '../Agent/ToolName.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import { createCheckpointApi } from '../Checkpoint/CheckpointApi.js'
import { describeZone } from '../Zone/ZoneDigest.js'
import type { ZoneRepository } from '../Zone/ZoneRepository.js'
import { createZoneApi } from '../Zone/ZoneApi.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import { createCriterionApi } from '../Criterion/CriterionApi.js'
import type { Dispatcher } from '../Dispatch/Dispatcher.js'
import { PHASE_CONTRACTS } from '../Dispatch/Dispatch.js'
import type { BudgetRepository } from '../Budget/BudgetRepository.js'
import { createBudgetApi } from '../Budget/BudgetApi.js'
import { KANBAN_COLUMNS } from '../Story/Story.js'
import { createStoryApi } from '../Story/StoryApi.js'
import { createHumanGateApi } from '../Story/HumanGateApi.js'
import type { MergeCleanupReport } from '../Deployment/MergeCleanup.js'
import type { CascadeStep } from '../Checkpoint/ReviewCascade.js'
import { mapApiError } from './ApiErrorMap.js'
import { isConfinedPath } from '../File/ConfinedPath.js'
import { readJobStates, readRoster } from '../../technical/ClaudeCode/JobStateReader.js'

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

const epicDraftSchema = z.object({
  projectId: z.number().int().positive(),
  title: z.string().min(1),
  businessIntent: z.string().min(1),
})

const identifierSchema = z.coerce.number().int().positive()

const hookPayloadSchema = z.object({
  session_id: z.string().min(1),
  hook_event_name: z.string().min(1),
  tool_name: z.string().nullish(),
  tool_input: z.object({ file_path: z.string().nullish() }).passthrough().nullish(),
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

  api.onError(mapApiError)

  api.route('/', createBudgetApi({ budget, events }))

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

  api.route(
    '/',
    createStoryApi({
      repository,
      agentSessions,
      checkpoints,
      criteria,
      events,
      dispatcher,
      cleanUpAfterMerge,
    }),
  )

  api.route(
    '/',
    createCheckpointApi({ repository, checkpoints, events, advanceReviewCascade }),
  )

  api.route('/', createCriterionApi({ criteria }))

  api.route('/', createHumanGateApi({ stories: repository, events }))

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
      isWriteTool(hook.tool_name) &&
      path !== null &&
      path !== undefined
    if (!touchesAFile) {
      return context.json({ recorded: false }, 202)
    }

    if (!isConfinedPath(path)) {
      return context.json({ error: 'UnconfinedFilePath', recorded: false }, 422)
    }

    const session = agentSessions.findByClaudeSessionId(hook.session_id)
    if (session === null) {
      return context.json({ recorded: false }, 202)
    }

    agentSessions.recordFileTouch({ claudeSessionId: hook.session_id, path })
    const zone = zones.zoneOfPath(repository.projectOfStory(session.storyId), path)
    if (zone !== null) {
      zones.summariseZone(
        zone.projectId,
        zone.pathPrefix,
        describeZone(zones.overviewOfZone(zone.projectId, zone.pathPrefix)),
      )
    }
    return context.json({ recorded: true }, 202)
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

  api.route('/', createZoneApi({ zones }))

  api.get('/api/files/conflicts', (context) => context.json(agentSessions.listConflictingPaths()))

  api.get('/api/fleet', (context) =>
    context.json({
      roster: readRoster(claudeHome),
      jobs: readJobStates(claudeHome),
    }),
  )

  return api
}
