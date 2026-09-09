import { describe, expect, it } from 'vitest'
import { COST_PER_STORY_USD, estimateRun } from '../../../src/domain/Resource/Estimate.js'

describe('estimateRun', () => {
  it('ne coute rien sans story', () => {
    expect(estimateRun({ stories: 0, capUsd: 20, spentUsd: 0 })).toMatchObject({
      costUsd: 0,
      memoryMb: 0,
    })
  })

  it('chiffre le lot au prorata du nombre de stories', () => {
    expect(estimateRun({ stories: 3, capUsd: 20, spentUsd: 0 }).costUsd).toBe(
      Number((3 * COST_PER_STORY_USD).toFixed(2)),
    )
  })

  it('dit ce qui reste sous le plafond', () => {
    expect(estimateRun({ stories: 1, capUsd: 20, spentUsd: 8.5 }).remainingUsd).toBe(11.5)
  })

  it('ne rend jamais un reste negatif, le plafond est deja creve', () => {
    expect(estimateRun({ stories: 1, capUsd: 20, spentUsd: 25 }).remainingUsd).toBe(0)
  })

  it('alerte quand le lot ne rentre pas dans ce qui reste', () => {
    expect(estimateRun({ stories: 5, capUsd: 20, spentUsd: 18 }).affordable).toBe(false)
  })

  it('laisse passer un lot qui rentre pile', () => {
    expect(estimateRun({ stories: 2, capUsd: 20, spentUsd: 17.2 }).affordable).toBe(true)
  })

  it('refuse un lot qui depasse d un cheveu', () => {
    expect(estimateRun({ stories: 2, capUsd: 20, spentUsd: 17.21 }).affordable).toBe(false)
  })
})
