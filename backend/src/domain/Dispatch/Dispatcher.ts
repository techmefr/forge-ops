import type Database from 'better-sqlite3'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { BudgetRepository } from '../Budget/BudgetRepository.js'
import { BudgetExhaustedError } from '../Budget/BudgetViolation.js'
import type { Story } from '../Story/Story.js'
import { contractOfPhase, type Dispatched, type DispatchOrder, type SessionRunner } from './Dispatch.js'
import { createRateBucket, DEFAULT_DISPATCH_RATE, type Clock, type DispatchRate } from './DispatchRate.js'
import {
  DispatchTooFastError,
  FleetSaturatedError,
  PhaseNotReadyError,
  SessionAlreadyRunningError,
  StoryBlockedError,
} from './DispatchViolation.js'

const RUNNING_LIFECYCLES = ['starting', 'working', 'awaiting_human'] as const

export type DispatcherInput = {
  database: Database.Database
  stories: StoryRepository
  checkpoints: CheckpointRepository
  sessions: AgentSessionRepository
  runner: SessionRunner
  budget: BudgetRepository
  concurrencyCap: number
  claudeCodeVersion: string
  rate?: DispatchRate
  clock?: Clock
}

export type Dispatcher = {
  dispatch: (order: DispatchOrder) => Promise<Dispatched>
  countRunning: () => number
}

function promptFor(story: Story, phase: string): string {
  return [
    `Story ${story.reference} — ${story.title}`,
    ``,
    story.body,
    ``,
    `Phase : ${phase}. Suis la doctrine de .claude/commands et prouve l'etape par un fichier sous .claude/evidence/${story.reference}/.`,
  ].join('\n')
}

export function createDispatcher({
  database,
  stories,
  checkpoints,
  sessions,
  runner,
  budget,
  concurrencyCap,
  claudeCodeVersion,
  rate = DEFAULT_DISPATCH_RATE,
  clock = Date.now,
}: DispatcherInput): Dispatcher {
  const bucket = createRateBucket(rate)
  const placeholders = RUNNING_LIFECYCLES.map(() => '?').join(', ')
  const countRunningSessions = database.prepare<string[], { total: number }>(
    `SELECT COUNT(*) AS total FROM agent_session WHERE lifecycle IN (${placeholders})`,
  )
  const countRunningOnStory = database.prepare<[number, ...string[]], { total: number }>(
    `SELECT COUNT(*) AS total FROM agent_session
      WHERE story_id = ? AND lifecycle IN (${placeholders})`,
  )
  const selectBlockers = database.prepare<[number], { reference: string }>(
    `SELECT story.reference AS reference FROM story_dependency
       JOIN story ON story.id = story_dependency.blocking_story_id
      WHERE story_dependency.blocked_story_id = ?
        AND story.state <> 'done'
      ORDER BY story.reference`,
  )

  function countRunning(): number {
    return countRunningSessions.get(...RUNNING_LIFECYCLES)?.total ?? 0
  }

  return {
    dispatch: async (order) => {
      const story = stories.findStory(order.storyId)
      const contract = contractOfPhase(order.phase)

      const blockers = selectBlockers.all(order.storyId).map((row) => row.reference)
      if (blockers.length > 0) {
        throw new StoryBlockedError(story.reference, blockers)
      }

      const proven = checkpoints
        .definitionOfDone(order.storyId)
        .filter((step) => step.proven)
        .map((step) => step.name)
      const missing = contract.requires.filter((name) => !proven.includes(name))
      if (missing.length > 0) {
        throw new PhaseNotReadyError(order.phase, missing)
      }

      if ((countRunningOnStory.get(order.storyId, ...RUNNING_LIFECYCLES)?.total ?? 0) > 0) {
        throw new SessionAlreadyRunningError(story.reference, order.phase)
      }

      const running = countRunning()
      if (running >= concurrencyCap) {
        throw new FleetSaturatedError(running, concurrencyCap)
      }

      if (!bucket.take(clock())) {
        throw new DispatchTooFastError(rate.burst, rate.windowMs)
      }

      const decision = budget.decideConduct()
      if (decision.conduct === 'stop') {
        throw new BudgetExhaustedError(decision.spentUsd, decision.capUsd)
      }

      const prompt = promptFor(story, order.phase)
      const { claudeSessionId } = await runner.launch({
        storyId: order.storyId,
        reference: story.reference,
        phase: order.phase,
        agentName: contract.agentName,
        prompt,
        ...(decision.model === undefined ? {} : { model: decision.model }),
        ...(decision.baseUrl === undefined ? {} : { baseUrl: decision.baseUrl }),
      })

      sessions.registerSession({
        storyId: order.storyId,
        claudeSessionId,
        phase: order.phase,
        agentName: contract.agentName,
        claudeCodeVersion,
      })

      return {
        claudeSessionId,
        storyId: order.storyId,
        phase: order.phase,
        agentName: contract.agentName,
        prompt,
        ...(decision.model === undefined ? {} : { model: decision.model }),
        ...(decision.baseUrl === undefined ? {} : { baseUrl: decision.baseUrl }),
      }
    },

    countRunning,
  }
}
