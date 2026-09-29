import { Hono } from 'hono'
import { z } from 'zod'
import {
  decisionDraftSchema,
  riskDraftSchema,
  riskPatchSchema,
  weatherChangeSchema,
} from '../../../../contract/FollowUpContract.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import type { EventBus } from '../../technical/Http/EventBus.js'
import { mayAdministerProject } from '../Project/ProjectAuthority.js'
import type { ProjectRepository } from '../Project/ProjectRepository.js'
import type { FollowUpRepository } from './FollowUpRepository.js'

const identifierSchema = z.coerce.number().int().positive()

export type FollowUpApiInput = {
  followUps: FollowUpRepository
  projects: ProjectRepository
  events: EventBus
  today: () => string
  isSuperAdmin: (login: string) => boolean
}

export function createFollowUpApi({ followUps, projects, events, today, isSuperAdmin }: FollowUpApiInput): Hono {
  const api = new Hono()

  api.get('/api/projects/:id/follow-up', (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    return context.json(followUps.followUp(projectId.data, today()))
  })

  api.post('/api/projects/:id/risks', async (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    const draft = riskDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidRiskDraft', issues: draft.error.issues }, 422)
    }
    const risk = followUps.openRisk(projectId.data, draft.data, today())
    events.publish({ name: 'risk.created', payload: { id: risk.id, projectId: risk.projectId } })
    return context.json(risk, 201)
  })

  api.patch('/api/risks/:id', async (context) => {
    const riskId = identifierSchema.safeParse(context.req.param('id'))
    if (!riskId.success) {
      return context.json({ error: 'InvalidRiskIdentifier' }, 422)
    }
    const patch = riskPatchSchema.safeParse(await context.req.json().catch(() => null))
    if (!patch.success) {
      return context.json({ error: 'InvalidRiskPatch', issues: patch.error.issues }, 422)
    }
    const risk = followUps.updateRisk(riskId.data, patch.data, today())
    events.publish({ name: 'risk.updated', payload: { id: risk.id, projectId: risk.projectId } })
    return context.json(risk)
  })

  api.post('/api/projects/:id/decisions', async (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    const draft = decisionDraftSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidDecisionDraft', issues: draft.error.issues }, 422)
    }
    const decision = followUps.recordDecision(projectId.data, draft.data, operatorOf(context), today())
    events.publish({ name: 'decision.created', payload: { id: decision.id, projectId: decision.projectId } })
    return context.json(decision, 201)
  })

  api.put('/api/projects/:id/weather', async (context) => {
    const projectId = identifierSchema.safeParse(context.req.param('id'))
    if (!projectId.success) {
      return context.json({ error: 'InvalidProjectIdentifier' }, 422)
    }
    const change = weatherChangeSchema.safeParse(await context.req.json().catch(() => null))
    if (!change.success) {
      return context.json({ error: 'InvalidWeatherChange', issues: change.error.issues }, 422)
    }
    const admin = projects.find(projectId.data)
    if (admin !== null) {
      const login = operatorOf(context)
      if (!mayAdministerProject({ login, ...admin, isSuperAdmin })) {
        return context.json({ error: 'ProjectAdminRequired' }, 403)
      }
    }
    followUps.changeWeather(projectId.data, change.data)
    events.publish({ name: 'project.weather', payload: { projectId: projectId.data } })
    return context.json(followUps.followUp(projectId.data, today()))
  })

  return api
}
