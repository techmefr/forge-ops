import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import { createBoardI18n } from '@/technical/Language/I18n'
import ForgeUsageCard from '@/domain/Forge/ForgeUsageCard.vue'
import { usageOf } from '@/domain/Forge/ForgeUsage'

function card(overrides: Partial<ForgeCardView> = {}): ForgeCardView {
  return {
    id: 1,
    reference: 'FC-1',
    storyId: 1,
    storyReference: 'PS-1',
    title: 'Card',
    projectId: 1,
    workflowId: 1,
    subjectId: 1,
    subjectTitle: 'Subject',
    stepKey: 'build',
    provider: 'claude',
    status: 'running',
    claudeSessionId: null,
    durationSeconds: 0,
    costUsd: 0,
    ...overrides,
  }
}

describe('the usage of a card', () => {
  it('is unused before any session ran', () => {
    expect(usageOf(card())).toEqual({ used: false, inputTokens: 0, outputTokens: 0, totalTokens: 0 })
  })

  it('adds input and output tokens', () => {
    expect(usageOf(card({ inputTokens: 1200, outputTokens: 300 }))).toMatchObject({ used: true, totalTokens: 1500 })
  })

  it('counts a card with only a cost as used', () => {
    expect(usageOf(card({ costUsd: 0.4 })).used).toBe(true)
  })
})

describe('the usage card', () => {
  function mounted(view: ForgeCardView) {
    return mount(ForgeUsageCard, { props: { card: view }, global: { plugins: [createBoardI18n('en')] } })
  }

  it('shows nothing for a card that never ran', () => {
    expect(mounted(card()).find('[data-test="forge-usage"]').exists()).toBe(false)
  })

  it('shows the cost, the tokens with their split, and the agent time', () => {
    const usage = mounted(card({ costUsd: 1.61, durationSeconds: 2520, inputTokens: 6_000_000, outputTokens: 900_000 }))
    expect(usage.find('[data-test="forge-usage-cost"]').text()).toBe('$1.61')
    expect(usage.find('[data-test="forge-usage-tokens"]').text()).toBe('6.9M')
    expect(usage.find('[data-test="forge-usage-split"]').text()).toContain('In 6M')
    expect(usage.find('[data-test="forge-usage-split"]').text()).toContain('Out 900K')
    expect(usage.find('[data-test="forge-usage-time"]').text()).toBe('42 min')
  })
})
