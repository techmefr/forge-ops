import { describe, expect, it } from 'vitest'
import { provisionalTitle } from '@/domain/Story/Slice'

describe('provisionalTitle', () => {
  it('numerote le decoupage a partir de un', () => {
    expect(provisionalTitle(0)).toBe('Decoupage 1, a nommer')
  })

  it('suit le rang des stories deja ecrites', () => {
    expect(provisionalTitle(2)).toBe('Decoupage 3, a nommer')
  })
})
