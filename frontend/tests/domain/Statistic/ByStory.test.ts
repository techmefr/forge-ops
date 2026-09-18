import { describe, expect, it } from 'vitest'
import { perStory } from '../../../src/domain/Statistic/ByStory.js'
import type { SessionHistoryEntry } from '../../../src/domain/Board/BoardModel.js'

function session(over: Partial<SessionHistoryEntry>): SessionHistoryEntry {
  return {
    id: 1,
    storyId: 1,
    storyReference: 'FRG-1',
    phase: 'code',
    agentName: 'elrond',
    lifecycle: 'finished',
    outcome: 'succeeded',
    costUsd: 1,
    inputTokens: null,
    outputTokens: null,
    startedAt: '2026-09-18T08:00:00Z',
    endedAt: '2026-09-18T08:10:00Z',
    seconds: 600,
    ...over,
  }
}

describe('perStory', () => {
  it('additionne les sessions d une meme story', () => {
    const tallies = perStory([session({}), session({ id: 2 })])

    expect(tallies).toHaveLength(1)
    expect(tallies[0]?.sessions).toBe(2)
    expect(tallies[0]?.seconds).toBe(1200)
    expect(tallies[0]?.costUsd).toBe(2)
  })

  it('garde chaque story sur sa ligne', () => {
    const tallies = perStory([session({}), session({ id: 2, storyId: 2, storyReference: 'FRG-2' })])

    expect(tallies.map((one) => one.storyReference).sort()).toEqual(['FRG-1', 'FRG-2'])
  })

  it('met devant la story qui a pris le plus de temps', () => {
    const tallies = perStory([
      session({ seconds: 60 }),
      session({ id: 2, storyId: 2, storyReference: 'FRG-2', seconds: 900 }),
    ])

    expect(tallies[0]?.storyReference).toBe('FRG-2')
  })

  it('compte une session encore ouverte sans temps ni cout', () => {
    const tallies = perStory([session({ seconds: null, costUsd: null })])

    expect(tallies[0]).toEqual({
      storyId: 1,
      storyReference: 'FRG-1',
      sessions: 1,
      seconds: 0,
      costUsd: 0,
    })
  })

  it('ne rend rien sans historique', () => {
    expect(perStory([])).toEqual([])
  })
})
