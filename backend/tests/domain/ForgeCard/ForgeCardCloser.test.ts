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

function earnedCloser(publishStory: ForgeCardCloserInput['publishStory'], order: string[]) {
  return createForgeCardCloser({
    board: { view: () => ({ id: 1, projectId: 1, storyId: 2, reference: 'S-2', stepKey: 'ship', status: 'to_validate' }) },
    forgeCards: { closeForgeCard: () => order.push('closed') },
    stories: {
      findStory: () => ({ id: 2, reference: 'S-2', epicId: 3 }),
      findEpic: () => ({ businessIntent: 'manage' }),
      markDoneAndUnblock: () => {
        order.push('done')
        return []
      },
    },
    columns: { list: () => [{ key: 'spec' }, { key: 'ship' }] },
    checkpoints: { definitionOfDone: () => [], reviewCascade: () => ['quality', 'security', 'accessibility'].map((lens) => ({ lens, state: 'passed', agentName: null })), listUnresolvedFindings: () => [] },
    criteria: { listCriteria: () => [{ reference: 'AC-1', satisfied: true, evidencePath: '.claude/evidence/S-2/ac.md' }] },
    cleanUpAfterMerge: () => {
      order.push('cleaned')
      return { scopesReleased: 0, worktreeClosed: true, worktreeRefusal: null }
    },
    ...(publishStory === undefined ? {} : { publishStory }),
  } as unknown as ForgeCardCloserInput)
}

describe('publishing the story when its card is closed', () => {
  it('publishes after the done gate and before the worktree is cleaned', () => {
    const order: string[] = []
    const closer = earnedCloser((storyId) => {
      order.push(`published ${storyId}`)
      return { branch: 'story/s-2', pushed: true, requestUrl: 'https://example.test/pr/1', mergeRequested: false, note: null }
    }, order)

    const closed = closer.close(1)

    expect(order).toEqual(['published 2', 'done', 'cleaned', 'closed'])
    expect(closed.publication?.requestUrl).toBe('https://example.test/pr/1')
  })

  it('leaves the card open and untouched when the publication fails', () => {
    const order: string[] = []
    const closer = earnedCloser(() => {
      throw new Error('push refused')
    }, order)

    expect(() => closer.close(1)).toThrow('push refused')
    expect(order).toEqual([])
  })

  it('reports no publication when none is configured', () => {
    const order: string[] = []

    expect(earnedCloser(undefined, order).close(1).publication).toBeNull()
  })
})
