import type Database from 'better-sqlite3'
import type { AgentSessionRepository } from '../domain/Agent/AgentSessionRepository.js'
import { createAutopilotConductor, type AutopilotConductor } from '../domain/Autopilot/AutopilotConductor.js'
import type { AutopilotRepository } from '../domain/Autopilot/AutopilotRepository.js'
import { createStepProver } from '../domain/Autopilot/StepProver.js'
import type { BudgetRepository } from '../domain/Budget/BudgetRepository.js'
import type { CheckpointRepository } from '../domain/Checkpoint/CheckpointRepository.js'
import type { MessageRepository } from '../domain/Conversation/MessageRepository.js'
import type { CriterionRepository } from '../domain/Criterion/CriterionRepository.js'
import { cleanUpAfterMerge } from '../domain/Deployment/MergeCleanup.js'
import type { Dispatcher } from '../domain/Dispatch/Dispatcher.js'
import { createStepEntry } from '../domain/Dispatch/StepEntry.js'
import type { EvidenceReader } from '../domain/Evidence/EvidenceRead.js'
import type { ForemergeRepository } from '../domain/Foremerge/ForemergeRepository.js'
import { createForgeBoardRepository } from '../domain/ForgeCard/ForgeBoardRepository.js'
import { createForgeCardCloser } from '../domain/ForgeCard/ForgeCardCloser.js'
import { createForgeCardMover } from '../domain/ForgeCard/ForgeCardMover.js'
import type { ForgeCardRepository } from '../domain/ForgeCard/ForgeCardRepository.js'
import type { StoryRepository } from '../domain/Story/StoryRepository.js'
import type { WorkflowColumnRepository } from '../domain/Workflow/WorkflowColumnRepository.js'
import type { WorktreeRepository } from '../domain/Worktree/WorktreeRepository.js'
import { clearVerdictFile } from '../technical/Evidence/VerdictFile.js'
import { writeEvidenceFile } from '../technical/Evidence/EvidenceFileWriter.js'
import { projectTestCommand } from '../technical/Gate/ProjectTestCommand.js'
import { createStoryPublishing, integrityOfStory, lastAgentMessageOf } from './ForgeStoryPublishing.js'
import { createStoryInspection } from '../technical/Git/StoryInspection.js'
import type { GuardrailSeal } from '../technical/Guardrail/GuardrailSeal.js'
import type { EventBus } from '../technical/Http/EventBus.js'

const AUTOPILOT_EVERY_MS = 5000

export type ForgeAutopilotInput = {
  db: Database.Database
  ticking: boolean
  stories: StoryRepository
  sessions: AgentSessionRepository
  budget: BudgetRepository
  messages: MessageRepository
  foremerge: ForemergeRepository
  forgeCards: ForgeCardRepository
  workflowColumns: WorkflowColumnRepository
  autopilotSettings: AutopilotRepository
  checkpoints: CheckpointRepository
  criteria: CriterionRepository
  worktrees: WorktreeRepository
  dispatcher: Dispatcher
  guardrailSeal: GuardrailSeal
  cwdForStory: (storyId: number) => string
  readEvidence: EvidenceReader
  events: EventBus
}

export type ForgeAutopilot = ReturnType<typeof createForgeAutopilot>

function proverOf({
  checkpoints,
  criteria,
  sessions,
}: Pick<ForgeAutopilotInput, 'checkpoints' | 'criteria' | 'sessions'>) {
  return createStepProver({
    checkpoints,
    criteria,
    inspection: createStoryInspection({ testCommandOf: (root) => projectTestCommand(root) }),
    writeEvidence: writeEvidenceFile,
    latestSessionOf: (storyId) => sessions.latestSessionOf(storyId),
  })
}

export function createForgeAutopilot({
  db,
  ticking,
  stories,
  sessions,
  budget,
  messages,
  foremerge,
  forgeCards,
  workflowColumns,
  autopilotSettings,
  checkpoints,
  criteria,
  worktrees,
  dispatcher,
  guardrailSeal,
  cwdForStory,
  readEvidence,
  events,
}: ForgeAutopilotInput) {
  let running: AutopilotConductor | null = null
  const board = createForgeBoardRepository(db, {
    forgeCards,
    columns: workflowColumns,
    autoOf: (view) => running?.autoViewOf(view) ?? null,
  })
  board.backfillCards()
  const closer = createForgeCardCloser({
    board,
    forgeCards,
    stories,
    columns: workflowColumns,
    checkpoints,
    criteria,
    cleanUpAfterMerge: (storyId) =>
      cleanUpAfterMerge({
        storyId,
        releaseScope: foremerge.release,
        closeWorktree: (target) => worktrees.close(target, { deleteBranch: true }),
      }),
    publishStory: createStoryPublishing({ stories, autopilotSettings, worktrees, events }),
  })
  const mover = createForgeCardMover({
    board,
    forgeCards,
    stories,
    columns: workflowColumns,
    enterStep: createStepEntry({ dispatcher, columns: workflowColumns }),
    launchStep: (entry) => dispatcher.dispatch(entry),
  })
  const conductor = createAutopilotConductor({
    autopilot: autopilotSettings,
    board,
    forgeCards,
    stories,
    criteria,
    budget,
    columns: workflowColumns,
    sessions,
    checkpoints,
    readEvidence,
    cwdOf: cwdForStory,
    clearVerdict: clearVerdictFile,
    mover,
    closer,
    prover: proverOf({ checkpoints, criteria, sessions }),
    baseShaOf: (storyId) => worktrees.findForStory(storyId)?.baseSha ?? null,
    integrityOf: integrityOfStory(guardrailSeal, cwdForStory),
    lastAgentMessage: lastAgentMessageOf(messages),
    publish: (name, payload) => events.publish({ name, payload }),
  })
  running = conductor
  const timer = ticking ? setInterval(() => void conductor.tick(), AUTOPILOT_EVERY_MS) : null
  timer?.unref()
  return {
    board,
    closer,
    mover,
    conductor,
    stop: (): void => {
      if (timer !== null) {
        clearInterval(timer)
      }
    },
  }
}
