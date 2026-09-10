import { describe, expect, it } from 'vitest'
import { PARTS, PART_LABELS, bothPartsWritten, partOf } from '@/domain/Story/StoryPart'
import type { Story, Ticket } from '@/domain/Board/BoardModel'

const STORY = {
  id: 1,
  reference: 'FORGE-1',
  title: 'visualiser les mails',
  body: 'en tant que...',
} as Story

const TWIN = { ...STORY, id: 2, reference: 'FORGE-1-T', title: 'prouver la visualisation' } as Story

const TICKET = {
  functional: STORY,
  tests: null,
  criteria: [],
  dod: [],
  cascade: [],
  blockers: [],
} as unknown as Ticket

describe('les deux parties de la story', () => {
  it('sont la fonctionnelle et sa jumelle de test', () => {
    expect([...PARTS]).toEqual(['functional', 'tests'])
  })

  it('portent toutes les deux un nom', () => {
    for (const part of PARTS) {
      expect(PART_LABELS[part].length).toBeGreaterThan(0)
    }
  })
})

describe('partOf', () => {
  it('rend la story fonctionnelle', () => {
    expect(partOf(TICKET, 'functional')).toBe(STORY)
  })

  it('rend la jumelle quand elle est ecrite', () => {
    expect(partOf({ ...TICKET, tests: TWIN }, 'tests')).toBe(TWIN)
  })

  it('ne rend rien quand la jumelle manque', () => {
    expect(partOf(TICKET, 'tests')).toBe(null)
  })

  it('ne rend rien sans ticket', () => {
    expect(partOf(null, 'functional')).toBe(null)
  })
})

describe('bothPartsWritten', () => {
  it('refuse une story sans sa jumelle', () => {
    expect(bothPartsWritten(TICKET)).toBe(false)
  })

  it('accepte une story dont les deux parties sont ecrites', () => {
    expect(bothPartsWritten({ ...TICKET, tests: TWIN })).toBe(true)
  })

  it('refuse quand il n y a pas de ticket du tout', () => {
    expect(bothPartsWritten(null)).toBe(false)
  })
})
