import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GROUPING,
  extractionOf,
  groupingOf,
  isRefusal,
  joinRefusalOf,
  type Batch,
} from '../../../src/domain/Delivery/Grouping.js'

function batch(storyIds: readonly number[], state: Batch['state'] = 'open'): Batch {
  return { id: 1, projectId: 7, branch: 'story/forge-1', state, storyIds }
}

describe('what the board does by default', () => {
  it('carries one story per merge request', () => {
    expect(DEFAULT_GROUPING).toBe('single')
    expect(groupingOf(null)).toBe('single')
    expect(groupingOf('bavardage')).toBe('single')
  })

  it('reads the mode an organisation settled on', () => {
    expect(groupingOf('grouped')).toBe('grouped')
  })
})

describe('joining a merge request', () => {
  it('refuses a second story when grouping is off', () => {
    expect(joinRefusalOf('single', batch([1]), { id: 2, projectId: 7 })).toBe('GroupingIsOff')
  })

  it('accepts a second story when the organisation chose grouping', () => {
    expect(joinRefusalOf('grouped', batch([1]), { id: 2, projectId: 7 })).toBeNull()
  })

  it('never joins a merge request already shipped', () => {
    expect(joinRefusalOf('grouped', batch([1], 'shipped'), { id: 2, projectId: 7 })).toBe(
      'BatchAlreadyShipped',
    )
  })

  it('never mixes two projects', () => {
    expect(joinRefusalOf('grouped', batch([1]), { id: 2, projectId: 8 })).toBe('ForeignProject')
  })

  it('never files the same story twice', () => {
    expect(joinRefusalOf('grouped', batch([1, 2]), { id: 2, projectId: 7 })).toBe('AlreadyJoined')
  })
})

describe('pulling a story out of a session in flight', () => {
  it('leaves the others behind', () => {
    const outcome = extractionOf(batch([1, 2, 3]), 2)
    expect(isRefusal(outcome)).toBe(false)
    expect(outcome).toEqual({ storyId: 2, leftBehind: [1, 3] })
  })

  it('refuses a story the merge request never carried', () => {
    expect(extractionOf(batch([1, 3]), 2)).toBe('StoryNotInBatch')
  })

  it('refuses once the merge request has shipped', () => {
    expect(extractionOf(batch([1, 2], 'shipped'), 2)).toBe('BatchAlreadyShipped')
  })

  it('refuses to empty a merge request', () => {
    expect(extractionOf(batch([2]), 2)).toBe('LastStoryOfTheBatch')
  })
})
