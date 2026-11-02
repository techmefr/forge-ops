import type { StepVerdict } from '../../../../contract/AutopilotContract.js'
import type { Checkpoint, CheckpointName } from '../Checkpoint/Checkpoint.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import type { StoryInspection } from './StoryInspection.js'

export type ProofOrder = {
  storyId: number
  storyReference: string
  root: string
  baseSha: string
  stepKey: string
  proves: CheckpointName | null
  verdict: StepVerdict
  workflowPhases?: readonly string[]
}

export type ProofOutcome = { kind: 'ok'; proven: readonly Checkpoint[] } | { kind: 'fail'; reason: string }

export type StepProver = {
  prove: (order: ProofOrder) => ProofOutcome
}

export type ReviewerSession = {
  claudeSessionId: string
}

export type StepProverInput = {
  checkpoints: Pick<
    CheckpointRepository,
    'definitionOfDone' | 'proveCheckpoint' | 'reviewCascade' | 'startLens' | 'passLens' | 'recordFinding'
  >
  criteria: Pick<CriterionRepository, 'listCriteria' | 'satisfyCriterion'>
  inspection: StoryInspection
  writeEvidence: (root: string, path: string, content: string) => void
  latestSessionOf: (storyId: number) => ReviewerSession | null
}
