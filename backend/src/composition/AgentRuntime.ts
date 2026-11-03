import type Database from 'better-sqlite3'
import { DEFAULT_FORGE_CARD_PROVIDER } from '../../../contract/ForgeCardContract.js'
import type { AgentSessionRepository } from '../domain/Agent/AgentSessionRepository.js'
import type { BudgetRepository } from '../domain/Budget/BudgetRepository.js'
import { createCheckpointRepository } from '../domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../domain/Criterion/CriterionRepository.js'
import { DEFAULT_DISPATCH_RATE } from '../domain/Dispatch/DispatchRate.js'
import { createDispatcher } from '../domain/Dispatch/Dispatcher.js'
import { columnAgentOfPhase, createDrivenRunner } from '../domain/Driver/Driver.js'
import type { ForemergeRepository } from '../domain/Foremerge/ForemergeRepository.js'
import type { ForgeCardRepository } from '../domain/ForgeCard/ForgeCardRepository.js'
import type { StoryRepository } from '../domain/Story/StoryRepository.js'
import type { TemplateRepository } from '../domain/Template/TemplateRepository.js'
import type { WorkflowColumnRepository } from '../domain/Workflow/WorkflowColumnRepository.js'
import type { WorkflowRepository } from '../domain/Workflow/WorkflowRepository.js'
import { createWorktreeRepository } from '../domain/Worktree/WorktreeRepository.js'
import type { BoardEvent, EventBus } from '../technical/Http/EventBus.js'
import type { EvidenceReader } from '../domain/Evidence/EvidenceRead.js'
import { createGitWorktree } from '../technical/Git/GitWorktree.js'
import { createDoctrineSource } from '../technical/Doctrine/DoctrineSource.js'
import { projectTestCommand } from '../technical/Gate/ProjectTestCommand.js'
import { carryLocalSettings } from '../technical/Guardrail/LocalSettings.js'
import { createGuardrailSeal } from '../technical/Guardrail/GuardrailSeal.js'
import type { LiveSessions } from '../technical/ClaudeCode/LiveSessions.js'
import type { SdkUserTurn } from '../technical/ClaudeCode/TurnDelivery.js'
import { createAgentDrivers } from './AgentDrivers.js'
import { createCheckoutResolver, createProofGates } from './ProjectCheckout.js'
import { createStoryWorkspace } from './StoryWorkspace.js'

const DEFAULT_SESSION_CAP = 5

export const sessionCap = Number(process.env.FORGE_SESSION_CAP ?? DEFAULT_SESSION_CAP)

const DEFAULT_MUTATION_TEST_COMMAND = 'npx vitest run'

const DEFAULT_RED_TEST_COMMAND = 'npx vitest run --reporter=json'

export type AgentRuntimeInput = {
  db: Database.Database
  stories: StoryRepository
  sessions: AgentSessionRepository
  budget: BudgetRepository
  foremerge: ForemergeRepository
  workflow: WorkflowRepository
  workflowColumns: WorkflowColumnRepository
  forgeCards: ForgeCardRepository
  templates: TemplateRepository
  readEvidence: EvidenceReader
  live: LiveSessions<SdkUserTurn>
  events: EventBus
  onSessionEvent: (event: BoardEvent) => void
  testsDir: string
  worktreeRoot: string
}

export type AgentRuntime = ReturnType<typeof createAgentRuntime>

function providerOfOrder(forgeCards: ForgeCardRepository) {
  return (order: { provider?: string; forgeCardId?: number }) =>
    order.provider ??
    (order.forgeCardId === undefined
      ? DEFAULT_FORGE_CARD_PROVIDER
      : forgeCards.findForgeCard(order.forgeCardId).provider)
}

function dispatchRateFromEnv() {
  return {
    burst: Number(process.env.FORGE_DISPATCH_BURST ?? DEFAULT_DISPATCH_RATE.burst),
    windowMs: Number(process.env.FORGE_DISPATCH_WINDOW_MS ?? DEFAULT_DISPATCH_RATE.windowMs),
  }
}

export function createAgentRuntime({
  db,
  stories,
  sessions,
  budget,
  foremerge,
  workflow,
  workflowColumns,
  forgeCards,
  templates,
  readEvidence,
  live,
  events,
  onSessionEvent,
  testsDir,
  worktreeRoot,
}: AgentRuntimeInput) {
  const guardrailSeal = createGuardrailSeal(process.cwd())
  const checkouts = createCheckoutResolver({
    stories,
    worktreePathOf: (storyId) => worktrees.findForStory(storyId)?.path ?? null,
  })
  const { cwdForStory } = checkouts
  const checkpointGates = createProofGates({
    readEvidence,
    testsDir,
    redCommand: process.env.FORGE_RED_TEST_COMMAND ?? DEFAULT_RED_TEST_COMMAND,
    mutationCommand: process.env.FORGE_MUTATION_TEST_COMMAND ?? DEFAULT_MUTATION_TEST_COMMAND,
    mutationCommandOf: (root) =>
      process.env.FORGE_MUTATION_TEST_COMMAND === undefined ? projectTestCommand(root) : null,
    cwdForStory,
  })
  const worktrees = createWorktreeRepository(db, {
    stories,
    git: createGitWorktree({ repositoryRoot: process.cwd() }),
    root: worktreeRoot,
    checkoutOf: checkouts.checkoutOfStory,
  })
  const checkpoints = createCheckpointRepository(db, checkpointGates)
  const criteria = createCriterionRepository(db)
  const drivers = createAgentDrivers({
    cwdForStory,
    branchOfStory: (storyId) => worktrees.findForStory(storyId)?.branch ?? null,
    live,
    seal: guardrailSeal,
    onEvent: onSessionEvent,
  })
  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints,
    criteria,
    sessions,
    budget,
    foremerge,
    workflow,
    forgeCards,
    workflowColumns,
    prepareWorkspace: createStoryWorkspace({
      hasCheckout: checkouts.hasCheckout,
      worktrees,
      onOpened: (opened) => events.publish({ name: 'worktree.opened', payload: { ...opened } }),
      equip: (worktree) => carryLocalSettings(checkouts.checkoutOfStory(worktree.storyId), worktree.path),
    }),
    doctrineFor: createDoctrineSource({ forgeRoot: process.cwd(), checkoutOf: cwdForStory }),
    runner: createDrivenRunner({
      drivers,
      providerOf: providerOfOrder(forgeCards),
      columnAgentOf: (order) =>
        columnAgentOfPhase(templates.templateOfProject(stories.projectOfStory(order.storyId)).columns, order.phase),
    }),
    concurrencyCap: sessionCap,
    claudeCodeVersion: process.env.CLAUDE_CODE_VERSION ?? 'unknown',
    rate: dispatchRateFromEnv(),
  })
  return { guardrailSeal, cwdForStory, worktrees, checkpoints, criteria, drivers, dispatcher }
}
