import { describe, expect, it } from 'vitest'
import { refusalOfSelection } from '../../../src/domain/ForgeCard/ForgeCard.js'

describe('refusalOfSelection', () => {
  it('refuse une selection vide', () => {
    expect(refusalOfSelection([])).toEqual({ reason: 'EmptySelection' })
  })

  it('refuse une selection avec un doublon', () => {
    expect(refusalOfSelection([4, 7, 4])).toEqual({ reason: 'DuplicateStoryId', storyId: 4 })
  })

  it('accepte une selection valide', () => {
    expect(refusalOfSelection([4, 7])).toBeNull()
  })
})
