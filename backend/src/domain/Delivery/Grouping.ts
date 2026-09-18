export {
  BATCH_STATES,
  DEFAULT_GROUPING,
  GROUPING_MODES,
} from '../../../../contract/DeliveryContract.js'
export type { Batch, BatchState, GroupingMode } from '../../../../contract/DeliveryContract.js'

import {
  DEFAULT_GROUPING,
  GROUPING_MODES,
  type Batch,
  type GroupingMode,
} from '../../../../contract/DeliveryContract.js'

export type JoinRefusal = 'GroupingIsOff' | 'BatchAlreadyShipped' | 'ForeignProject' | 'AlreadyJoined'

export type ExtractionRefusal = 'StoryNotInBatch' | 'BatchAlreadyShipped' | 'LastStoryOfTheBatch'

export type Extraction = {
  storyId: number
  leftBehind: readonly number[]
}

export function groupingOf(stored: string | null): GroupingMode {
  return GROUPING_MODES.find((mode) => mode === stored) ?? DEFAULT_GROUPING
}

export function joinRefusalOf(
  mode: GroupingMode,
  batch: Batch,
  story: { id: number; projectId: number },
): JoinRefusal | null {
  if (mode === 'single' && batch.storyIds.length > 0 && !batch.storyIds.includes(story.id)) {
    return 'GroupingIsOff'
  }
  if (batch.state === 'shipped') {
    return 'BatchAlreadyShipped'
  }
  if (batch.projectId !== story.projectId) {
    return 'ForeignProject'
  }
  return batch.storyIds.includes(story.id) ? 'AlreadyJoined' : null
}

export function extractionOf(batch: Batch, storyId: number): Extraction | ExtractionRefusal {
  if (batch.state === 'shipped') {
    return 'BatchAlreadyShipped'
  }
  if (!batch.storyIds.includes(storyId)) {
    return 'StoryNotInBatch'
  }
  if (batch.storyIds.length === 1) {
    return 'LastStoryOfTheBatch'
  }
  return { storyId, leftBehind: batch.storyIds.filter((one) => one !== storyId) }
}

export function isRefusal(
  outcome: Extraction | ExtractionRefusal,
): outcome is ExtractionRefusal {
  return typeof outcome === 'string'
}
