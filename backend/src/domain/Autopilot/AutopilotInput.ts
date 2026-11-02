import type { ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { BudgetRepository } from '../Budget/BudgetRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import type { EvidenceReader } from '../Evidence/EvidenceRead.js'
import type { ForgeBoardRepository } from '../ForgeCard/ForgeBoardRepository.js'
import type { ForgeCardCloser } from '../ForgeCard/ForgeCardCloser.js'
import type { ForgeCardMover } from '../ForgeCard/ForgeCardMover.js'
import type { ForgeCardRepository } from '../ForgeCard/ForgeCardRepository.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'
import type { AutoCardView } from '../../../../contract/AutopilotContract.js'
import type { AutopilotRepository } from './AutopilotRepository.js'
import type { StepProver } from './StepProver.js'

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
  integrityOf?: (storyId: number) => string | null
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
