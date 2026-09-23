import type Database from 'better-sqlite3'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import { scoreCompleteness } from '../Story/Completeness.js'
import type { BudgetRepository } from '../Budget/BudgetRepository.js'
import { BudgetExhaustedError } from '../Budget/BudgetViolation.js'
import type { ForemergeRepository } from '../Foremerge/ForemergeRepository.js'
import { ScopeTakenError } from '../Foremerge/ForemergeViolation.js'
import { collisionsBetween } from '../Foremerge/Scope.js'
import type { Story } from '../Story/Story.js'
import type { WorkflowRepository } from '../Workflow/WorkflowRepository.js'
import { createWorkflowRepository } from '../Workflow/WorkflowRepository.js'
import {
  contractOfPhase,
  type Dispatched,
  type DispatchOrder,
  type PhaseContract,
  type SessionRunner,
} from './Dispatch.js'
import { EVIDENCE_SHAPE } from '../Evidence/EvidenceShape.js'
import { LENS_AGENTS, nextLensOf } from '../Checkpoint/ReviewCascade.js'
import { createRateBucket, DEFAULT_DISPATCH_RATE, type Clock, type DispatchRate } from './DispatchRate.js'
import { LensOutOfOrderError } from '../Checkpoint/CheckpointViolation.js'
import {
  DispatchTooFastError,
  FleetSaturatedError,
  LensOutsideReviewError,
  PhaseNotReadyError,
  SessionAlreadyRunningError,
  StoryBlockedError,
  StoryTooThinError,
} from './DispatchViolation.js'

const RUNNING_LIFECYCLES = ['starting', 'working', 'awaiting_human'] as const

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
}

export type Dispatcher = {
  dispatch: (order: DispatchOrder) => Promise<Dispatched>
  countRunning: () => number
}

function promptFor(
  story: Story,
  contract: PhaseContract,
  lens: string | undefined,
  preprompt: string,
): string {
  const doctrine = `Suis la doctrine de .claude/commands/${contract.command}.`
  const sections =
    contract.proves === null
      ? []
      : [
          `Prouve ${contract.proves} par un fichier sous .claude/evidence/${story.reference}/ dont les titres de section portent : ${EVIDENCE_SHAPE[contract.proves].join(', ')}.`,
        ]
  return [
    ...(preprompt.trim() === '' ? [] : [preprompt, ``]),
    `Story ${story.reference} — ${story.title}`,
    ``,
    story.body,
    ``,
    lens === undefined
      ? `Phase : ${contract.phase}. ${doctrine}`
      : `Phase : ${contract.phase}, lentille ${lens}. ${doctrine} Ne lis que cette lentille.`,
    ...sections,
  ].join('\n')
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
      const staticContract = contractOfPhase(order.phase)
      const configured = workflow.readPhases().find((entry) => entry.phase === order.phase)
      const contract: PhaseContract =
        configured === undefined
          ? staticContract
          : { ...staticContract, agentName: configured.agentName, command: configured.command }
      if (order.lens !== undefined && order.phase !== 'review') {
        throw new LensOutsideReviewError(order.phase)
      }
      const agentName = order.lens === undefined ? contract.agentName : LENS_AGENTS[order.lens]
      if (order.lens !== undefined) {
        const expected = nextLensOf(checkpoints.reviewCascade(order.storyId))
        if (expected !== order.lens) {
          throw new LensOutOfOrderError(order.lens, expected ?? order.lens)
        }
      }

      if (order.phase !== 'spec') {
        const verdict = scoreCompleteness({
          title: story.title,
          body: story.body,
          criteria: criteria.listCriteria(order.storyId).map((criterion) => criterion.reference),
          hasTwin: stories.findTwin(order.storyId) !== null,
        })
        if (!verdict.launchable) {
          throw new StoryTooThinError(story.reference, verdict.score, verdict.gaps)
        }
      }

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

      if (order.phase !== 'spec') {
        const held = foremerge.listReservations()
        const mine = held.filter((reservation) => reservation.storyId === order.storyId)
        for (const claim of mine) {
          for (const other of held) {
            const collision = collisionsBetween([claim, other])[0]
            if (collision !== undefined) {
              throw new ScopeTakenError(claim.pathPrefix, other.storyReference, other.reservedAt, collision.reason)
            }
          }
        }
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

      const prompt = promptFor(story, contract, order.lens, configured?.preprompt ?? '')
      const { claudeSessionId } = await runner.launch({
        storyId: order.storyId,
        reference: story.reference,
        phase: order.phase,
        agentName,
        prompt,
        ...(decision.model === undefined ? {} : { model: decision.model }),
        ...(decision.baseUrl === undefined ? {} : { baseUrl: decision.baseUrl }),
      })

      sessions.registerSession({
        storyId: order.storyId,
        claudeSessionId,
        phase: order.phase,
        agentName,
        claudeCodeVersion,
      })

      if (order.lens !== undefined) {
        checkpoints.startLens(order.storyId, order.lens, claudeSessionId)
      }

      return {
        claudeSessionId,
        storyId: order.storyId,
        phase: order.phase,
        ...(order.lens === undefined ? {} : { lens: order.lens }),
        agentName,
        prompt,
        ...(decision.model === undefined ? {} : { model: decision.model }),
        ...(decision.baseUrl === undefined ? {} : { baseUrl: decision.baseUrl }),
      }
    },

    countRunning,
  }
}
