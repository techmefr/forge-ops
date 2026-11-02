import type { Hono } from 'hono'
import { z } from 'zod'
import { projectCreateSchema } from '../../../../contract/ProjectContract.js'
import {
  MANUAL_EPIC_STATES,
  epicAssignmentSchema,
  epicCreateSchema,
  epicQuerySchema,
} from '../../../../contract/EpicContract.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import { parseBody } from '../../technical/Http/ParseBody.js'
import { ProjectSlugTakenError } from '../Story/StoryViolation.js'
import type { BoardApiInput } from './BoardApi.js'

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

const DEFAULT_INTEGRATION_BRANCH = 'main'

const identifierSchema = z.coerce.number().int().positive()

const stateWithClaimSchema = z.enum(MANUAL_EPIC_STATES).optional()

function slugOf(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug === '' ? 'project' : slug
}

function freeSlug(base: string, taken: ReadonlySet<string>): string {
  let candidate = base
  for (let attempt = 2; taken.has(candidate); attempt += 1) {
    candidate = `${base}-${attempt}`
  }
  return candidate
}

type ProjectRoutesInput = Pick<BoardApiInput, 'repository' | 'events'>

export function mountProjectRoutes(api: Hono, { repository, events }: ProjectRoutesInput): void {
  api.post('/api/projects', async (context) => {
    const body = await context.req.json().catch(() => null)
    const legacy = projectDraftSchema.safeParse(body)
    if (legacy.success) {
      const project = repository.createProject(legacy.data)
      events.publish({ name: 'project.created', payload: { ...project } })
      return context.json(project, 201)
    }
    const draft = projectCreateSchema.safeParse(body)
    if (!draft.success) {
      return context.json({ error: 'InvalidProjectDraft', issues: draft.error.issues }, 422)
    }
    const existing = repository.listProjects()
    if (existing.some((project) => project.name.toLowerCase() === draft.data.name.toLowerCase())) {
      throw new ProjectSlugTakenError(draft.data.name)
    }
    const project = repository.createProject({
      slug: freeSlug(slugOf(draft.data.name), new Set(existing.map((entry) => entry.slug))),
      name: draft.data.name,
      repositoryUrl: draft.data.repository,
      integrationBranch: DEFAULT_INTEGRATION_BRANCH,
      colour: draft.data.colour,
    })
    events.publish({ name: 'project.created', payload: { ...project } })
    return context.json(project, 201)
  })

  api.get('/api/projects', (context) => context.json(repository.listProjects()))
}

export function mountEpicRoutes(
  api: Hono,
  { repository, events, today, isSuperAdmin, isDirector }: ProjectRoutesInput & Required<Pick<BoardApiInput, 'today' | 'isSuperAdmin' | 'isDirector'>>,
): void {
  api.post('/api/epics', async (context) => {
    const draft = await parseBody(context, epicCreateSchema)
    if (!draft.success) {
      return context.json({ error: 'InvalidEpicDraft', issues: draft.error.issues }, 422)
    }
    const epic = repository.createSubject(draft.data, operatorOf(context))
    events.publish({ name: 'epic.created', payload: { ...epic } })
    return context.json(epic, 201)
  })

  api.put('/api/epics/:id/assignee', async (context) => {
    const epicId = identifierSchema.safeParse(context.req.param('id'))
    const body = await parseBody(context, epicAssignmentSchema)
    if (!epicId.success || !body.success) {
      return context.json({ error: 'InvalidEpicAssignment' }, 422)
    }
    repository.assignEpic(epicId.data, body.data.login)
    events.publish({ name: 'epic.updated', payload: { id: epicId.data } })
    return context.json({ id: epicId.data, assignee: body.data.login })
  })

  api.get('/api/board/self', (context) => {
    const login = operatorOf(context)
    return context.json({ login, superAdmin: isSuperAdmin(login), director: isDirector(login) })
  })

  api.post('/api/epics/:id/claim', async (context) => {
    const epicId = identifierSchema.safeParse(context.req.param('id'))
    const body = (await context.req.json().catch(() => ({}))) as { state?: unknown } | null
    const state = stateWithClaimSchema.safeParse(body?.state)
    if (!epicId.success || !state.success) {
      return context.json({ error: 'InvalidEpicIdentifier' }, 422)
    }
    repository.claimEpic(epicId.data, operatorOf(context), state.data)
    return context.json({ claimed: true })
  })

  api.delete('/api/epics/:id/claim', (context) => {
    const epicId = identifierSchema.safeParse(context.req.param('id'))
    const state = stateWithClaimSchema.safeParse(context.req.query('state'))
    if (!epicId.success || !state.success) {
      return context.json({ error: 'InvalidEpicIdentifier' }, 422)
    }
    repository.releaseEpic(epicId.data, operatorOf(context), state.data)
    return context.json({ released: true })
  })

  api.get('/api/epics', (context) => {
    const query = epicQuerySchema.safeParse(context.req.query())
    if (!query.success) {
      return context.json({ error: 'InvalidEpicQuery', issues: query.error.issues }, 422)
    }
    return context.json(repository.listEveryEpic(query.data, today()))
  })

  api.get('/api/projects/:id/epics', (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    return context.json(
      repository.listEpics(projectId.data, {
        today: today(),
        deleted: context.req.query('deleted') === 'true',
      }),
    )
  })
}
