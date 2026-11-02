import { Hono } from 'hono'
import type { Context } from 'hono'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import { createCheckpointApi } from '../Checkpoint/CheckpointApi.js'
import type { ZoneRepository } from '../Zone/ZoneRepository.js'
import { createZoneApi } from '../Zone/ZoneApi.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import { createCriterionApi } from '../Criterion/CriterionApi.js'
import type { Dispatcher } from '../Dispatch/Dispatcher.js'
import type { BudgetRepository } from '../Budget/BudgetRepository.js'
import { createBudgetApi } from '../Budget/BudgetApi.js'
import { createEpicApi } from '../Epic/EpicApi.js'
import { createEventApi } from '../Event/EventApi.js'
import { createProjectApi } from '../Project/ProjectApi.js'
import { createFollowUpApi } from '../FollowUp/FollowUpApi.js'
import { createStoryApi } from '../Story/StoryApi.js'
import { createHumanGateApi } from '../Story/HumanGateApi.js'
import type { MergeCleanupReport } from '../Deployment/MergeCleanup.js'
import type { CascadeStep } from '../Checkpoint/ReviewCascade.js'
import type { StoryHold } from '../Discussion/Discussion.js'
import { mapApiError } from './ApiErrorMap.js'
import { mountEpicRoutes, mountProjectRoutes } from './BoardProjectRoutes.js'
import { mountSessionRoutes } from './BoardSessionRoutes.js'
import { mountBoardViewRoutes } from './BoardViewRoutes.js'

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
  openHolds?: () => readonly StoryHold[]
  today?: () => string
  isSuperAdmin?: (login: string) => boolean
  isDirector?: (login: string) => boolean
  maySettleBudget?: (context: Context) => boolean
  mayReadFleet?: (context: Context) => boolean
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
  openHolds = () => [],
  today = () => new Date().toISOString().slice(0, 10),
  isSuperAdmin = () => false,
  isDirector = () => false,
  maySettleBudget = (context) => {
    const login = operatorOf(context)
    return isSuperAdmin(login) || isDirector(login)
  },
  mayReadFleet,
}: BoardApiInput): Hono {
  const api = new Hono()
  api.onError(mapApiError)

  api.route('/', createBudgetApi({ budget, events, maySettle: maySettleBudget }))
  mountProjectRoutes(api, { repository, events })
  mountEpicRoutes(api, { repository, events, today, isSuperAdmin, isDirector })

  api.route('/', createEpicApi({ epics: repository.epics, events, today, projects: repository.projects, isSuperAdmin, isDirector }))
  api.route('/', createEventApi({ agenda: repository.agenda, events }))
  api.route('/', createProjectApi({ projects: repository.projects, events, isSuperAdmin, isDirector }))
  api.route('/', createFollowUpApi({ followUps: repository.followUps, projects: repository.projects, events, today, isSuperAdmin, isDirector }))
  api.route('/', createStoryApi({ repository, agentSessions, checkpoints, criteria, events, dispatcher, cleanUpAfterMerge }))
  api.route('/', createCheckpointApi({ repository, checkpoints, events, advanceReviewCascade }))
  api.route('/', createCriterionApi({ criteria }))
  api.route('/', createHumanGateApi({ stories: repository, events }))

  mountSessionRoutes(api, { repository, agentSessions, zones })
  mountBoardViewRoutes(api, {
    repository,
    agentSessions,
    events,
    claudeHome,
    openHolds,
    today,
    mayReadFleet: mayReadFleet ?? maySettleBudget,
  })
  api.route('/', createZoneApi({ zones }))
  return api
}
