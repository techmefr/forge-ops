import { describe, expect, it } from 'vitest'
import { countedOf, sessionEndOf } from '@/domain/Agent/SessionEnd'

describe('sessionEndOf', () => {
  it('dit la sortie en francais quand la session est finie', () => {
    expect(sessionEndOf('succeeded', 'finished')).toBe('Reussie')
  })

  it('retombe sur le cycle de vie quand aucune sortie n est encore ecrite', () => {
    expect(sessionEndOf(null, 'working')).toBe('Au travail')
  })

  it('dit qu une session attend une reponse humaine', () => {
    expect(sessionEndOf(null, 'awaiting_human')).toBe('Attend ta reponse')
  })

  it('avoue un mot inconnu plutot que de rendre du vide', () => {
    expect(sessionEndOf('bizarre', 'working')).toBe('bizarre')
  })
})

describe('countedOf', () => {
  it('laisse le mot au singulier a un', () => {
    expect(countedOf(1, 'session')).toBe('1 session')
  })

  it('met le mot au pluriel au dela', () => {
    expect(countedOf(3, 'session')).toBe('3 sessions')
  })

  it('accepte un pluriel anglais en ies', () => {
    expect(countedOf(3, 'story', 'stories')).toBe('3 stories')
  })

  it('met le mot au singulier a zero, comme le veut le francais', () => {
    expect(countedOf(0, 'session')).toBe('0 session')
  })

  it('accepte un pluriel irregulier', () => {
    expect(countedOf(2, 'travail', 'travaux')).toBe('2 travaux')
  })
})
