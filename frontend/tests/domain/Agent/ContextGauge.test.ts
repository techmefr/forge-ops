import { describe, expect, it } from 'vitest'
import { contextGaugeColour, contextGaugeOf } from '@/domain/Agent/ContextGauge'

describe('contextGaugeOf', () => {
  it('ne renvoie rien quand la session ne porte aucun contexte', () => {
    expect(contextGaugeOf(null)).toBeNull()
  })

  it('calcule le pourcentage quand la fenetre est connue', () => {
    expect(contextGaugeOf({ tokens: 50000, window: 200000 })).toEqual({
      tokens: 50000,
      window: 200000,
      percent: 25,
    })
  })

  it('laisse le pourcentage vide quand la fenetre est inconnue', () => {
    expect(contextGaugeOf({ tokens: 4000, window: null })).toEqual({
      tokens: 4000,
      window: null,
      percent: null,
    })
  })
})

describe('contextGaugeColour', () => {
  it('reste neutre quand le pourcentage est inconnu', () => {
    expect(contextGaugeColour(null)).toBe('bg-line')
  })

  it('reste vert tant que la consommation est raisonnable', () => {
    expect(contextGaugeColour(40)).toBe('bg-green')
  })

  it('passe a l orange en approche de la saturation', () => {
    expect(contextGaugeColour(75)).toBe('bg-orange')
  })

  it('passe au rouge quand le contexte est presque plein', () => {
    expect(contextGaugeColour(95)).toBe('bg-red')
  })
})
