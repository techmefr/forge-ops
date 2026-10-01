import {
  BACKLOG_STEP_KEY,
  DONE_STEP_KEY,
  type ForgeCardMoved,
  type ForgeCardView,
} from '../../../../contract/ForgeCardContract.js'
import { MAX_AUTO_TRANSITIONS, type AutoCardView } from '../../../../contract/AutopilotContract.js'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import {
  CheckpointAlreadyProvenError,
  CheckpointOutOfOrderError,
  CriteriaRequiredError,
} from '../Checkpoint/CheckpointViolation.js'
import { BudgetExhaustedError } from '../Budget/BudgetViolation.js'
import type { BudgetRepository } from '../Budget/BudgetRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import { contractOfPhase } from '../Dispatch/Dispatch.js'
import {
  CheckoutMissingError,
  DispatchTooFastError,
  FleetSaturatedError,
  SessionAlreadyRunningError,
  StoryBlockedError,
  StoryTooThinError,
} from '../Dispatch/DispatchViolation.js'
import type { EvidenceReader } from '../Evidence/EvidenceRead.js'
import type { ForgeBoardRepository } from '../ForgeCard/ForgeBoardRepository.js'
import type { ForgeCardCloser, ForgeCardClosed } from '../ForgeCard/ForgeCardCloser.js'
import type { ForgeCardMover } from '../ForgeCard/ForgeCardMover.js'
import type { ForgeCardRepository } from '../ForgeCard/ForgeCardRepository.js'
import { phaseOfStep } from '../ForgeCard/ForgeCardStatus.js'
import { StepBusyError } from '../ForgeCard/ForgeCardViolation.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import { PublicationFailedError } from '../../technical/Git/StoryPublication.js'
import { proofPathOf } from './StepBrief.js'
import { readVerdict, safeVerdictPath } from './StepVerdict.js'
import type { StepProver } from './StepProver.js'
import type { StepVerdict } from '../../../../contract/AutopilotContract.js'
import type { AutopilotCardPatch, AutopilotCardRecord, AutopilotRepository } from './AutopilotRepository.js'

export type StepOutcome =
  | { kind: 'pass' }
  | { kind: 'fail'; reason: string }
  | { kind: 'blocked'; reason: string }

export type AutopilotConductorInput = {
  autopilot: AutopilotRepository
  board: ForgeBoardRepository
  forgeCards: Pick<ForgeCardRepository, 'openCardOfStory'>
  stories: Pick<StoryRepository, 'findStory' | 'listProjects'>
  criteria: Pick<CriterionRepository, 'listCriteria'>
  budget: Pick<BudgetRepository, 'decideConduct'>
  columns: WorkflowColumnRepository
  sessions: Pick<AgentSessionRepository, 'findByClaudeSessionId' | 'listRecentActivity'>
  checkpoints: Pick<CheckpointRepository, 'definitionOfDone' | 'proveCheckpoint'>
  readEvidence: EvidenceReader
  cwdOf: (storyId: number) => string
  clearVerdict: (root: string, verdictPath: string) => void
  mover: Pick<ForgeCardMover, 'move' | 'launch'>
  closer: Pick<ForgeCardCloser, 'close'>
  lastAgentMessage: (storyId: number) => string | null
  prover?: StepProver
  baseShaOf?: (storyId: number) => string | null
  publish?: (name: string, payload: Record<string, unknown>) => void
}

export type AutopilotConductor = {
  turnEnded: (claudeSessionId: string) => Promise<void>
  tick: () => Promise<void>
  resume: (forgeCardId: number) => Promise<boolean>
  reset: (forgeCardId: number) => void
  suspend: (forgeCardId: number) => () => void
  autoViewOf: (view: ForgeCardView) => AutoCardView | null
  idle: () => Promise<void>
}

const PREVIOUS_OUTPUT_LIMIT = 1500

export const NEEDS_CRITERIA_REASON = 'Needs acceptance criteria'

export const WAITING_BUDGET_REASON = 'Waiting: budget exhausted'

type Handling = 'wait' | 'budget' | 'red'

function handlingOf(error: unknown): Handling {
  if (
    error instanceof FleetSaturatedError ||
    error instanceof DispatchTooFastError ||
    error instanceof SessionAlreadyRunningError ||
    error instanceof StepBusyError
  ) {
    return 'wait'
  }
  return error instanceof BudgetExhaustedError ? 'budget' : 'red'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createAutopilotConductor({
  autopilot,
  board,
  forgeCards,
  stories,
  criteria,
  budget,
  columns,
  sessions,
  checkpoints,
  readEvidence,
  cwdOf,
  clearVerdict,
  mover,
  closer,
  lastAgentMessage,
  prover,
  baseShaOf,
  publish,
}: AutopilotConductorInput): AutopilotConductor {
  let queue: Promise<void> = Promise.resolve()

  function enqueue(work: () => Promise<void>): Promise<void> {
    const next = queue.then(work).catch(() => undefined)
    queue = next
    return next
  }

  function announce(moved: ForgeCardMoved): void {
    if (moved.started && moved.claudeSessionId !== null) {
      publish?.('session.dispatched', {
        storyId: moved.card.storyId,
        reference: moved.card.storyReference,
        claudeSessionId: moved.claudeSessionId,
      })
    }
  }

  function recordOf(view: ForgeCardView): AutopilotCardRecord {
    const record = autopilot.cardOf(view.id)
    if (record.stepKey === view.stepKey) {
      return record
    }
    return autopilot.patchCard(view.id, { stepKey: view.stepKey, attempts: 0, state: null, reason: null })
  }

  function patch(forgeCardId: number, change: AutopilotCardPatch): AutopilotCardRecord {
    const next = autopilot.patchCard(forgeCardId, change)
    publish?.('autopilot.changed', { forgeCardId, state: next.state, reason: next.reason, pending: next.pending })
    return next
  }

  function discard(root: string, storyReference: string, stepKey: string): void {
    const path = safeVerdictPath(storyReference, stepKey)
    if (path !== null) {
      clearVerdict(root, path)
    }
  }

  function previousOutputOf(storyId: number): string {
    const message = lastAgentMessage(storyId)
    return message === null ? '' : message.slice(-PREVIOUS_OUTPUT_LIMIT)
  }

  function feedbackOf(reason: string, storyId: number): string {
    const output = previousOutputOf(storyId)
    return output === '' ? reason : `${reason}\n\nYour previous output ended with:\n${output}`
  }

  function proveOwnCheckpoint(view: ForgeCardView, step: WorkflowColumn, storyReference: string): StepOutcome {
    const keys = columns.list(view.projectId).map((candidate) => candidate.key)
    const proves = contractOfPhase(phaseOfStep(step.key, keys)).proves
    if (proves === null) {
      return { kind: 'pass' }
    }
    const proven = checkpoints.definitionOfDone(view.storyId).find((entry) => entry.name === proves)?.proven === true
    if (proven) {
      return { kind: 'pass' }
    }
    try {
      const checkpoint = checkpoints.proveCheckpoint({
        storyId: view.storyId,
        name: proves,
        evidencePath: proofPathOf(storyReference, proves),
      })
      publish?.('checkpoint.proven', { ...checkpoint })
      return { kind: 'pass' }
    } catch (error) {
      if (error instanceof CheckpointOutOfOrderError || error instanceof CheckpointAlreadyProvenError) {
        return { kind: 'pass' }
      }
      if (error instanceof CriteriaRequiredError) {
        return { kind: 'blocked', reason: NEEDS_CRITERIA_REASON }
      }
      return { kind: 'fail', reason: messageOf(error) }
    }
  }

  function proveByOrchestrator(
    view: ForgeCardView,
    step: WorkflowColumn,
    storyReference: string,
    verdict: StepVerdict,
    activeProver: StepProver,
  ): StepOutcome {
    const keys = columns.list(view.projectId).map((candidate) => candidate.key)
    const baseSha = baseShaOf?.(view.storyId) ?? null
    if (baseSha === null) {
      return { kind: 'fail', reason: 'The story has no live worktree to inspect, so nothing can be proven' }
    }
    const outcome = activeProver.prove({
      storyId: view.storyId,
      storyReference,
      root: cwdOf(view.storyId),
      baseSha,
      stepKey: step.key,
      proves: contractOfPhase(phaseOfStep(step.key, keys)).proves,
      verdict,
    })
    if (outcome.kind === 'fail') {
      return outcome
    }
    for (const checkpoint of outcome.proven) {
      publish?.('checkpoint.proven', { ...checkpoint })
    }
    return { kind: 'pass' }
  }

  function verify(view: ForgeCardView, step: WorkflowColumn): StepOutcome {
    if (view.status === 'failed') {
      const latest = sessions.listRecentActivity(view.storyId, 1)[0]
      return { kind: 'fail', reason: `The agent session ended with ${latest?.outcome ?? 'an error'}` }
    }
    const story = stories.findStory(view.storyId)
    const root = cwdOf(view.storyId)
    const reading = readVerdict(readEvidence, root, story.reference, step.key)
    if (reading.kind === 'missing') {
      return { kind: 'fail', reason: `The agent did not write the step verdict at ${reading.path}` }
    }
    if (reading.kind === 'invalid') {
      return { kind: 'fail', reason: `The step verdict ${reading.path} is unusable: ${reading.reason}` }
    }
    discard(root, story.reference, step.key)
    if (reading.verdict.status === 'blocked') {
      return { kind: 'blocked', reason: reading.verdict.reason ?? 'The agent needs a human decision' }
    }
    if (reading.verdict.status === 'fail') {
      return { kind: 'fail', reason: reading.verdict.reason ?? 'The agent reported that the step failed' }
    }
    return prover === undefined
      ? proveOwnCheckpoint(view, step, story.reference)
      : proveByOrchestrator(view, step, story.reference, reading.verdict, prover)
  }

  function lacksCriteria(storyId: number): boolean {
    return stories.findStory(storyId).kind === 'functional' && criteria.listCriteria(storyId).length === 0
  }

  function budgetBlocks(): boolean {
    return budget.decideConduct().conduct === 'stop'
  }

  function backlogEntryOf(projectId: number): WorkflowColumn | null {
    const project = stories.listProjects().find((candidate) => candidate.id === projectId)
    const settings = autopilot.settingsOf(projectId)
    const first = columns.list(projectId)[0]
    const hasCheckout = project?.checkoutPath !== null && project?.checkoutPath !== undefined && project.checkoutPath !== ''
    if (!settings.enabled || !settings.autoLaunch || !hasCheckout) {
      return null
    }
    return first === undefined || first.provider === 'human' || !first.autoStart ? null : first
  }

  function parkOnError(forgeCardId: number, error: unknown, keepPending: boolean): void {
    const handling = handlingOf(error)
    if (handling === 'red') {
      const publication = error instanceof PublicationFailedError
      patch(forgeCardId, {
        state: 'red',
        reason: messageOf(error),
        ...(publication && keepPending ? {} : { pending: null }),
      })
      return
    }
    patch(forgeCardId, {
      state: 'paused',
      reason: handling === 'budget' ? WAITING_BUDGET_REASON : 'Waiting for a free session slot',
    })
  }

  async function advance(forgeCardId: number): Promise<void> {
    const view = board.view(forgeCardId)
    const record = autopilot.cardOf(forgeCardId)
    if (record.advances >= MAX_AUTO_TRANSITIONS) {
      patch(forgeCardId, {
        state: 'red',
        pending: null,
        reason: `The card reached the limit of ${MAX_AUTO_TRANSITIONS} automatic transitions`,
      })
      return
    }
    const steps = columns.list(view.projectId)
    const next = steps[steps.findIndex((step) => step.key === view.stepKey) + 1]
    if (next === undefined) {
      const closed: ForgeCardClosed = closer.close(forgeCardId)
      autopilot.resetCard(forgeCardId)
      publish?.('story.closed', { storyId: view.storyId, publication: closed.publication })
      return
    }
    const story = stories.findStory(view.storyId)
    discard(cwdOf(view.storyId), story.reference, next.key)
    const moved = await mover.move(forgeCardId, next.key)
    announce(moved)
    patch(forgeCardId, {
      stepKey: next.key,
      attempts: 0,
      advances: record.advances + 1,
      pending: null,
      state: null,
      reason: null,
      feedback: null,
    })
  }

  async function retry(forgeCardId: number, record: AutopilotCardRecord): Promise<void> {
    const view = board.view(forgeCardId)
    const story = stories.findStory(view.storyId)
    discard(cwdOf(view.storyId), story.reference, view.stepKey)
    const moved = await mover.launch(forgeCardId, record.feedback === null ? {} : { feedback: record.feedback })
    announce(moved)
    patch(forgeCardId, { pending: null, state: null, reason: null, feedback: null })
  }

  async function runPending(forgeCardId: number): Promise<void> {
    const record = autopilot.cardOf(forgeCardId)
    if (record.pending === null || record.state === 'red') {
      return
    }
    try {
      if (record.pending === 'retry') {
        await retry(forgeCardId, record)
      } else {
        await advance(forgeCardId)
      }
    } catch (error) {
      parkOnError(forgeCardId, error, record.pending === 'advance')
    }
  }

  async function evaluate(forgeCardId: number): Promise<void> {
    const view = board.view(forgeCardId)
    if (!autopilot.settingsOf(view.projectId).enabled) {
      return
    }
    if (view.stepKey === BACKLOG_STEP_KEY || view.stepKey === DONE_STEP_KEY) {
      return
    }
    const step = columns.list(view.projectId).find((candidate) => candidate.key === view.stepKey)
    if (step === undefined || step.provider === 'human') {
      return
    }
    if (view.status !== 'to_validate' && view.status !== 'failed') {
      return
    }
    const record = recordOf(view)
    if (record.pending !== null || record.state === 'red') {
      return
    }
    const outcome = verify(view, step)
    if (outcome.kind === 'blocked') {
      patch(forgeCardId, { state: 'paused', reason: `Blocked: ${outcome.reason}`, pending: null })
      return
    }
    if (outcome.kind === 'fail') {
      if (record.attempts < step.maxRetries) {
        patch(forgeCardId, {
          attempts: record.attempts + 1,
          state: null,
          reason: null,
          pending: 'retry',
          feedback: feedbackOf(outcome.reason, view.storyId),
        })
      } else {
        const retried = step.maxRetries > 0 ? ` after ${step.maxRetries} ${step.maxRetries === 1 ? 'retry' : 'retries'}` : ''
        patch(forgeCardId, {
          state: 'red',
          pending: null,
          reason: `${step.label} failed${retried}: ${outcome.reason}`,
        })
        return
      }
    } else {
      patch(forgeCardId, { attempts: 0, state: null, reason: null, pending: 'advance', feedback: null })
    }
    await runPending(forgeCardId)
  }

  async function launchBacklog(): Promise<void> {
    for (const project of stories.listProjects()) {
      const first = backlogEntryOf(project.id)
      if (first === null) {
        continue
      }
      const waiting = board
        .list(project.id)
        .filter((card) => card.stepKey === BACKLOG_STEP_KEY && autopilot.cardOf(card.id).state === null)
      for (const card of waiting) {
        if (lacksCriteria(card.storyId)) {
          continue
        }
        try {
          const moved = await mover.move(card.id, first.key)
          announce(moved)
          patch(card.id, { stepKey: first.key, attempts: 0, advances: 0, pending: null, state: null, reason: null })
        } catch (error) {
          if (error instanceof StoryTooThinError || error instanceof StoryBlockedError || error instanceof CheckoutMissingError) {
            continue
          }
          const handling = handlingOf(error)
          if (handling !== 'red') {
            return
          }
          patch(card.id, { state: 'red', reason: messageOf(error), pending: null })
        }
      }
    }
  }

  async function launchIdle(): Promise<void> {
    for (const project of stories.listProjects()) {
      const settings = autopilot.settingsOf(project.id)
      if (!settings.enabled || !settings.autoLaunch) {
        continue
      }
      const steps = columns.list(project.id)
      const idle = board.list(project.id).filter((card) => {
        const step = steps.find((candidate) => candidate.key === card.stepKey)
        const resumable =
          card.status === 'budget_exhausted' ? !budgetBlocks() : card.status === 'idle' && step?.autoStart === true
        return (
          resumable &&
          step !== undefined &&
          step.provider !== 'human' &&
          autopilot.cardOf(card.id).state === null &&
          autopilot.cardOf(card.id).pending === null
        )
      })
      for (const card of idle) {
        try {
          announce(await mover.launch(card.id))
        } catch (error) {
          if (error instanceof StoryTooThinError || error instanceof StoryBlockedError || error instanceof CheckoutMissingError) {
            continue
          }
          if (handlingOf(error) !== 'red') {
            return
          }
          patch(card.id, { state: 'red', reason: messageOf(error), pending: null })
        }
      }
    }
  }

  return {
    turnEnded: (claudeSessionId) =>
      enqueue(async () => {
        const session = sessions.findByClaudeSessionId(claudeSessionId)
        if (session === null) {
          return
        }
        const card = forgeCards.openCardOfStory(session.storyId)
        if (card === null) {
          return
        }
        await evaluate(card.id)
      }),

    tick: () =>
      enqueue(async () => {
        for (const record of autopilot.listPending()) {
          await runPending(record.forgeCardId)
        }
        await launchBacklog()
        await launchIdle()
      }),

    resume: (forgeCardId) => {
      const record = autopilot.cardOf(forgeCardId)
      if (record.state !== 'red' || record.pending === null) {
        return Promise.resolve(false)
      }
      return enqueue(async () => {
        patch(forgeCardId, { state: null, reason: null })
        await runPending(forgeCardId)
      }).then(() => true)
    },

    reset: (forgeCardId) => {
      autopilot.resetCard(forgeCardId)
    },

    suspend: (forgeCardId) => {
      const previous = autopilot.cardOf(forgeCardId)
      autopilot.resetCard(forgeCardId)
      return () => {
        if (previous.stepKey !== '') {
          autopilot.patchCard(forgeCardId, previous)
        }
      }
    },

    autoViewOf: (view) => {
      if (!autopilot.settingsOf(view.projectId).enabled) {
        return null
      }
      if (view.stepKey === BACKLOG_STEP_KEY || view.stepKey === DONE_STEP_KEY) {
        const record = autopilot.cardOf(view.id)
        if (record.state === 'red') {
          return { state: 'red', reason: record.reason }
        }
        if (view.stepKey === BACKLOG_STEP_KEY && lacksCriteria(view.storyId)) {
          return { state: 'paused', reason: NEEDS_CRITERIA_REASON }
        }
        if (view.stepKey === BACKLOG_STEP_KEY && backlogEntryOf(view.projectId) !== null && budgetBlocks()) {
          return { state: 'paused', reason: WAITING_BUDGET_REASON }
        }
        return null
      }
      const record = autopilot.cardOf(view.id)
      if (record.state === 'red') {
        return { state: 'red', reason: record.reason }
      }
      if (record.state === 'paused') {
        return { state: 'paused', reason: record.reason }
      }
      if (view.status === 'running' || record.pending !== null) {
        return { state: 'running', reason: null }
      }
      if (view.status === 'budget_exhausted') {
        return {
          state: 'paused',
          reason: autopilot.settingsOf(view.projectId).autoLaunch ? WAITING_BUDGET_REASON : 'Budget exhausted, press Retry to resume',
        }
      }
      if (view.status === 'stopped') {
        return { state: 'paused', reason: 'Stopped by a user, press Retry to resume' }
      }
      if (view.status === 'human_review') {
        return { state: 'paused', reason: 'Waiting for a human step' }
      }
      if (view.status === 'idle') {
        return { state: 'paused', reason: 'This step does not start automatically' }
      }
      return null
    },

    idle: () => queue,
  }
}
