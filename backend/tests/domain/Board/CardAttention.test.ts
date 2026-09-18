import { describe, expect, it } from 'vitest'
import { attentionOf, daysLeft } from '../../../src/domain/Board/CardAttention.js'
import type { Milestone, Story, StoryState } from '../../../../contract/StoryContract.js'

function story(state: StoryState, mergeConflict = false): Story {
  return {
    id: 1,
    epicId: 1,
    twinOfStoryId: null,
    reference: 'FRG-1',
    title: 'une story',
    body: 'un corps',
    kind: 'functional',
    state,
    points: null,
    rolloutPercent: null,
    mergeConflict,
    escalationReason: null,
  }
}

const MILESTONE: Milestone = { epicId: 1, kind: 'production', dueOn: '2026-09-20' }

function facts(over: Partial<Parameters<typeof attentionOf>[0]> = {}) {
  return {
    story: story('building'),
    blockers: [],
    held: false,
    milestone: MILESTONE,
    today: '2026-09-18',
    ...over,
  }
}

describe('daysLeft', () => {
  it('compte les jours qui restent avant la date', () => {
    expect(daysLeft(MILESTONE, '2026-09-18')).toBe(2)
  })

  it('compte en negatif une date deja passee', () => {
    expect(daysLeft(MILESTONE, '2026-09-25')).toBe(-5)
  })

  it('ne compte rien sans jalon', () => {
    expect(daysLeft(null, '2026-09-18')).toBeNull()
  })

  it('ne compte rien sur une date qui ne veut rien dire', () => {
    expect(daysLeft({ ...MILESTONE, dueOn: 'demain' }, '2026-09-18')).toBeNull()
  })
})

describe('attentionOf', () => {
  it('ne signale rien quand la story avance', () => {
    expect(attentionOf(facts())).toBeNull()
  })

  it('signale une story bloquee par une autre', () => {
    expect(attentionOf(facts({ blockers: ['FRG-2'] }))).toBe('blocked')
  })

  it('signale une story mise en attente a la main', () => {
    expect(attentionOf(facts({ held: true }))).toBe('blocked')
  })

  it('signale un conflit de fusion', () => {
    expect(attentionOf(facts({ story: story('building', true) }))).toBe('conflict')
  })

  it('signale une story qui attend une personne', () => {
    expect(attentionOf(facts({ story: story('plan_review') }))).toBe('gate')
    expect(attentionOf(facts({ story: story('shipping') }))).toBe('gate')
  })

  it('signale une date depassee', () => {
    expect(attentionOf(facts({ today: '2026-09-25' }))).toBe('late')
  })

  it('fait passer le blocage avant la date, une seule pastille par carte', () => {
    expect(attentionOf(facts({ today: '2026-09-25', blockers: ['FRG-2'] }))).toBe('blocked')
  })

  it('ne signale plus rien sur une story livree, meme en retard', () => {
    expect(attentionOf(facts({ story: story('done'), today: '2026-09-25' }))).toBeNull()
  })
})
