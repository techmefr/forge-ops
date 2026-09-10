import { describe, expect, it } from 'vitest'
import { holdOf } from '@/domain/Kanban/Hold'
import type { StoryHold } from '@/domain/Board/BoardModel'

const HELD: StoryHold = {
  id: 1,
  storyId: 7,
  reason: 'le plan touche deux projets',
  askedBy: 'elrond',
  raisedAt: '2026-09-10 10:00:00',
}

describe('holdOf', () => {
  it('rend le blocage de la story demandee', () => {
    expect(holdOf([HELD], 7)).toBe(HELD)
  })

  it('ne rend rien pour une story libre', () => {
    expect(holdOf([HELD], 9)).toBe(null)
  })

  it('ne rend rien quand rien ne bloque', () => {
    expect(holdOf([], 7)).toBe(null)
  })

  it('ne confond pas deux blocages', () => {
    const autre: StoryHold = { ...HELD, id: 2, storyId: 9, reason: 'conflit de merge' }

    expect(holdOf([HELD, autre], 9)?.reason).toBe('conflit de merge')
  })
})
