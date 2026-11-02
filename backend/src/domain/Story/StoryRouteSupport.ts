import { z } from 'zod'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import type { MergeCleanupReport } from '../Deployment/MergeCleanup.js'
import type { Dispatcher } from '../Dispatch/Dispatcher.js'
import type { StoryRepository } from './StoryRepository.js'

export const identifierSchema = z.coerce.number().int().positive()

export type StoryApiInput = {
  repository: StoryRepository
  agentSessions: AgentSessionRepository
  checkpoints: CheckpointRepository
  criteria: CriterionRepository
  events: EventBus
  dispatcher: Dispatcher
  cleanUpAfterMerge: (storyId: number) => MergeCleanupReport
}
