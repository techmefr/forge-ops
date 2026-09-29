import { describe, expect, it, vi } from 'vitest'
import type { ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import { createForgeCardCloser, type ForgeCardCloserInput } from '../../../src/domain/ForgeCard/ForgeCardCloser.js'
import { DoneIsFinalError, NotAtLastStepError, StepBusyError } from '../../../src/domain/ForgeCard/ForgeCardViolation.js'

function closerFor(view: Partial<ForgeCardView>, lastKey = 'ship') {
  const closeForgeCard = vi.fn()
  const closer = createForgeCardCloser({
    board: { view: () => ({ id: 1, projectId: 1, storyId: 2, reference: 'S-2', stepKey: 'ship', status: 'to_validate', ...view }) },
    forgeCards: { closeForgeCard },
    stories: {},
    columns: { list: () => [{ key: 'spec' }, { key: lastKey }] },
    checkpoints: {},
    criteria: {},
    cleanUpAfterMerge: vi.fn(),
  } as unknown as ForgeCardCloserInput)
  return { closer, closeForgeCard }
}

describe('closing a forge card', () => {
  it('refuses a card already done', () => {
    const { closer, closeForgeCard } = closerFor({ stepKey: 'done' })
    expect(() => closer.close(1)).toThrow(DoneIsFinalError)
    expect(closeForgeCard).not.toHaveBeenCalled()
  })

  it('refuses a running card', () => {
    expect(() => closerFor({ status: 'running' }).closer.close(1)).toThrow(StepBusyError)
  })

  it('refuses a card that is not in the last step', () => {
    const { closer, closeForgeCard } = closerFor({}, 'other')
    expect(() => closer.close(1)).toThrow(NotAtLastStepError)
    expect(closeForgeCard).not.toHaveBeenCalled()
  })
})
