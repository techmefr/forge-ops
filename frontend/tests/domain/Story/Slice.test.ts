import { describe, expect, it } from 'vitest'
import { provisionalTitle } from '@/domain/Story/Slice'

describe('provisionalTitle', () => {
  it('numerote le decoupage a partir de un', () => {
    expect(provisionalTitle(0)).toEqual({
      key: 'story.provisionalTitle',
      values: { number: 1 },
      count: null,
    })
  })

  it('suit le rang des stories deja ecrites', () => {
    expect(provisionalTitle(2).values.number).toBe(3)
  })
})
