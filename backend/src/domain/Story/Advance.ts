import type { CheckpointName } from '../Checkpoint/Checkpoint.js'
import type { StoryState } from './Story.js'

const STATE_AFTER_CHECKPOINT: Readonly<Record<CheckpointName, StoryState | null>> = {
  spec_done: 'architecture',
  arch_done: 'plan_review',
  tests_written: null,
  build_done: 'gating',
  verified: 'reviewing',
  reviewed: 'shipping',
}

export function stateAfterCheckpoint(name: CheckpointName): StoryState | null {
  return STATE_AFTER_CHECKPOINT[name]
}
