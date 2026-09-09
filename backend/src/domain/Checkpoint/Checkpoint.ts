export const CHECKPOINT_SEQUENCE = [
  'spec_done',
  'arch_done',
  'tests_written',
  'build_done',
  'verified',
  'reviewed',
] as const

export type CheckpointName = (typeof CHECKPOINT_SEQUENCE)[number]

export const REVIEW_LENS_SEQUENCE = ['quality', 'security', 'accessibility'] as const

export type ReviewLens = (typeof REVIEW_LENS_SEQUENCE)[number]

export type ReviewPassState = 'pending' | 'running' | 'passed'

export type ReviewPass = {
  lens: ReviewLens
  state: ReviewPassState
  agentName: string | null
}

export type FindingSeverity = 'strong' | 'weak'

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

export type DefinitionOfDoneStep = {
  name: CheckpointName
  proven: boolean
  evidencePath: string | null
}

export type ReviewFinding = {
  id: number
  storyId: number
  lens: ReviewLens
  severity: FindingSeverity
  path: string
  statement: string
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
