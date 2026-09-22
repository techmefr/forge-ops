import { describe, expect, it } from 'vitest'
import { cardsOf, tallyOf } from '../../../src/domain/Personal/Tally.js'
import type { ProjectCard } from '../../../src/domain/Board/BoardModel.js'

function card(over: Partial<ProjectCard>): ProjectCard {
  return {
    id: 1,
    epicId: 1,
    twinOfStoryId: null,
    reference: 'FRG-1',
    title: 'une story',
    body: 'un corps',
    kind: 'functional',
    state: 'building',
    points: null,
    rolloutPercent: null,
    mergeConflict: false,
    escalationReason: null,
    usage: { costUsd: 0, inputTokens: 0, outputTokens: 0 },
    blockers: [],
    context: null,
    activity: [],
    projectSlug: 'forge',
    projectColour: 'acc',
    epicTitle: 'une epique',
    holder: 'gaetan',
    milestone: null,
    daysLeft: null,
    attention: null,
    ...over,
  }
}

describe('cardsOf', () => {
  it('ne garde que les cartes de la personne', () => {
    const kept = cardsOf([card({}), card({ id: 2, holder: 'lea' })], 'gaetan')

    expect(kept.map((one) => one.id)).toEqual([1])
  })

  it('garde tout quand on ne sait pas qui regarde', () => {
    expect(cardsOf([card({}), card({ id: 2, holder: 'lea' })], null)).toHaveLength(2)
  })
})

describe('tallyOf', () => {
  it('compte les projets, pas les stories', () => {
    const tally = tallyOf([card({}), card({ id: 2 }), card({ id: 3, projectSlug: 'lumia' })], 'gaetan')

    expect(tally.mine).toBe(2)
  })

  it('compte ce qui est en retard', () => {
    const tally = tallyOf([card({ attention: 'late', daysLeft: -3 }), card({ id: 2 })], 'gaetan')

    expect(tally.late).toBe(1)
  })

  it('compte ce qui arrive dans la semaine, sans compter ce qui est deja passe', () => {
    const tally = tallyOf(
      [card({ daysLeft: 2 }), card({ id: 2, daysLeft: 9 }), card({ id: 3, daysLeft: -1 })],
      'gaetan',
    )

    expect(tally.soon).toBe(1)
  })

  it('compte tout ce qui demande une main, quelle que soit la raison', () => {
    const tally = tallyOf(
      [card({ attention: 'blocked' }), card({ id: 2, attention: 'gate' }), card({ id: 3 })],
      'gaetan',
    )

    expect(tally.attention).toBe(2)
  })

  it('ne compte rien quand la personne n a rien pris', () => {
    expect(tallyOf([card({ holder: 'lea' })], 'gaetan')).toEqual({
      mine: 0,
      late: 0,
      soon: 0,
      attention: 0,
    })
  })
})
