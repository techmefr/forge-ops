import { describe, expect, it } from 'vitest'
import { sessionEndKey } from '@/domain/Agent/SessionEnd'
import { AGENT_LIFECYCLE_SEQUENCE, OUTCOME_CLASSES } from '@/domain/Board/BoardModel'

describe('sessionEndKey', () => {
  it('pointe la sortie quand la session est finie', () => {
    expect(sessionEndKey('succeeded', 'finished')).toBe('outcome.succeeded')
  })

  it('retombe sur le cycle de vie quand aucune sortie n est encore ecrite', () => {
    expect(sessionEndKey(null, 'working')).toBe('lifecycle.working')
  })

  it('dit qu une session attend une reponse humaine', () => {
    expect(sessionEndKey(null, 'awaiting_human')).toBe('lifecycle.awaiting_human')
  })

  it('renvoie la sortie inconnue plutot qu une cle inventee', () => {
    expect(sessionEndKey('bizarre', 'working')).toBe('outcome.unknown')
  })

  it('refuse aussi un cycle de vie inconnu', () => {
    expect(sessionEndKey(null, 'licorne')).toBe('outcome.unknown')
  })

  it('donne une cle a chaque sortie du contrat', () => {
    for (const outcome of OUTCOME_CLASSES) {
      expect(sessionEndKey(outcome, 'finished')).toBe(`outcome.${outcome}`)
    }
  })

  it('donne une cle a chaque cycle de vie du contrat', () => {
    for (const lifecycle of AGENT_LIFECYCLE_SEQUENCE) {
      expect(sessionEndKey(null, lifecycle)).toBe(`lifecycle.${lifecycle}`)
    }
  })
})
