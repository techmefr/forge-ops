import { describe, expect, it } from 'vitest'
import { dotColourOf } from '@/domain/Agent/OutcomeColour'

describe('dotColourOf', () => {
  it('colore en vert une session reussie', () => {
    expect(dotColourOf('succeeded', 'finished')).toBe('bg-green')
  })

  it('colore en rouge une session tuee', () => {
    expect(dotColourOf('killed', 'interrupted')).toBe('bg-red')
  })

  it('retombe sur le cycle de vie quand aucune issue n est encore connue', () => {
    expect(dotColourOf(null, 'working')).toBe('bg-acc')
  })

  it('signale une session qui attend une decision humaine', () => {
    expect(dotColourOf(null, 'awaiting_human')).toBe('bg-warn')
  })

  it('reste neutre pour une issue qu elle ne reconnait pas', () => {
    expect(dotColourOf('mystere', 'working')).toBe('bg-txt-low')
  })
})
