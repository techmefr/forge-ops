export { CHECKPOINT_SEQUENCE, REVIEW_LENS_SEQUENCE } from '../../../../contract/CheckpointContract.js'
export type {
  CheckpointName,
  DefinitionOfDoneStep,
  FindingSeverity,
  ReviewFinding,
  ReviewLens,
  ReviewPass,
  ReviewPassState,
} from '../../../../contract/CheckpointContract.js'

import type {
  CheckpointName,
  FindingSeverity,
  ReviewLens,
} from '../../../../contract/CheckpointContract.js'

export type Checkpoint = {
  id: number
  storyId: number
  name: CheckpointName
  evidencePath: string
}

export type CheckpointDraft = {
  storyId: number
  name: CheckpointName
  evidencePath: string
}

export type ReviewFindingDraft = {
  storyId: number
  claudeSessionId: string
  lens: ReviewLens
  severity: FindingSeverity
  path: string
  line?: number
  statement: string
}
