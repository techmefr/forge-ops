import type Database from 'better-sqlite3'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import type { BudgetRepository } from '../Budget/BudgetRepository.js'
import type { ForemergeRepository } from '../Foremerge/ForemergeRepository.js'
import type { WorkflowRepository } from '../Workflow/WorkflowRepository.js'
import { createWorkflowRepository } from '../Workflow/WorkflowRepository.js'
import type { ForgeCardRepository } from '../ForgeCard/ForgeCardRepository.js'
import { createForgeCardRepository } from '../ForgeCard/ForgeCardRepository.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import { createWorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import type { Dispatched, DispatchOrder, SessionRunner } from './Dispatch.js'
import { createDispatchAdmission } from './DispatchAdmission.js'
import { createContractResolver } from './DispatchContract.js'
import { createDispatchGuards } from './DispatchGuards.js'
import { createDispatchLauncher } from './DispatchLauncher.js'
import { createPromptBuilder } from './DispatchPrompt.js'
import { createRateBucket, DEFAULT_DISPATCH_RATE, type Clock, type DispatchRate } from './DispatchRate.js'
import { prepareDispatchStatements } from './DispatchStatements.js'

export type DispatcherInput = {
  database: Database.Database
  stories: StoryRepository
  checkpoints: CheckpointRepository
  criteria: CriterionRepository
  sessions: AgentSessionRepository
  runner: SessionRunner
  budget: BudgetRepository
  foremerge: ForemergeRepository
  concurrencyCap: number
  claudeCodeVersion: string
  rate?: DispatchRate
  clock?: Clock
  workflow?: WorkflowRepository
  forgeCards?: ForgeCardRepository
  workflowColumns?: WorkflowColumnRepository
  prepareWorkspace?: (target: { storyId: number; forgeCardId: number | null }) => void
  doctrineFor?: (storyId: number, command: string) => string | null
}

export type Dispatcher = {
  dispatch: (order: DispatchOrder) => Promise<Dispatched>
  countRunning: () => number
}

export function createDispatcher({
  database,
  stories,
  checkpoints,
  criteria,
  sessions,
  runner,
  budget,
  foremerge,
  concurrencyCap,
  claudeCodeVersion,
  rate = DEFAULT_DISPATCH_RATE,
  clock = Date.now,
  workflow = createWorkflowRepository(database),
  forgeCards = createForgeCardRepository(database),
  workflowColumns = createWorkflowColumnRepository(database),
  prepareWorkspace,
  doctrineFor = () => null,
}: DispatcherInput): Dispatcher {
  const bucket = createRateBucket(rate)
  const statements = prepareDispatchStatements(database)
  const { countRunning } = statements
  const { resolve } = createContractResolver({ stories, checkpoints, workflow, workflowColumns })
  const guards = createDispatchGuards({ stories, checkpoints, criteria, foremerge, forgeCards, statements })
  const { admit } = createDispatchAdmission({ budget, bucket, rate, clock, concurrencyCap, countRunning })
  const { build } = createPromptBuilder({ stories, criteria, doctrineFor })
  const { launch } = createDispatchLauncher({
    runner,
    sessions,
    checkpoints,
    forgeCards,
    bucket,
    claudeCodeVersion,
    prepareWorkspace,
  })

  async function dispatch(order: DispatchOrder): Promise<Dispatched> {
    const resolved = resolve(order)
    guards.assertReady(order, resolved.story, resolved.contract)
    const claim = guards.claimCard(order, resolved.story)
    guards.assertScopeFree(order)
    const admission = admit(claim.waitingOnCard.length)
    const built = build(order, resolved, claim.forgeCard, admission)
    return launch({ order, resolved, claim, built, admission })
  }

  return { dispatch, countRunning }
}
