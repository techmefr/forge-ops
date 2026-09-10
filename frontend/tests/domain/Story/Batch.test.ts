import { describe, expect, it } from 'vitest'
import { storiesOfEpic } from '@/domain/Story/Batch'
import type { Story } from '@/domain/Board/BoardModel'

const UNE = { id: 1, epicId: 7, reference: 'FORGE-1' } as Story
const DEUX = { id: 2, epicId: 7, reference: 'FORGE-2' } as Story
const AILLEURS = { id: 3, epicId: 9, reference: 'MAILER-1' } as Story

describe('storiesOfEpic', () => {
  it('rend les stories ecrites pour cette epique', () => {
    expect(storiesOfEpic([UNE, DEUX, AILLEURS], 7)).toEqual([UNE, DEUX])
  })

  it('ne rend rien pour une epique sans story', () => {
    expect(storiesOfEpic([AILLEURS], 7)).toEqual([])
  })

  it('garde l ordre d ecriture', () => {
    expect(storiesOfEpic([DEUX, UNE], 7).map((story) => story.id)).toEqual([2, 1])
  })

  it('ne rend rien quand rien n a ete ecrit', () => {
    expect(storiesOfEpic([], 7)).toEqual([])
  })
})
