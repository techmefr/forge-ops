export const CHECKPOINT_SEQUENCE = [
  'spec_done',
  'arch_done',
  'tests_written',
  'build_done',
  'verified',
  'reviewed',
] as const

export type CheckpointName = (typeof CHECKPOINT_SEQUENCE)[number]

export type ReviewLens = 'quality' | 'security' | 'accessibility'

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
