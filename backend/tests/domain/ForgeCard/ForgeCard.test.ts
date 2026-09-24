import { describe, expect, it } from 'vitest'
import { isForgeCardProvider, refusalOfProvider, refusalOfSelection } from '../../../src/domain/ForgeCard/ForgeCard.js'

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

describe('refusalOfProvider', () => {
  it('accepte claude et codex', () => {
    expect(refusalOfProvider('claude')).toBeNull()
    expect(refusalOfProvider('codex')).toBeNull()
  })

  it('refuse un provider non enregistre', () => {
    expect(refusalOfProvider('opencode')).toEqual({ reason: 'UnknownProvider', provider: 'opencode' })
  })

  it('sert de garde de type', () => {
    expect(isForgeCardProvider('codex')).toBe(true)
    expect(isForgeCardProvider('opencode')).toBe(false)
  })
})
