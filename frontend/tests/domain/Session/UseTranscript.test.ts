import { describe, expect, it } from 'vitest'
import { collectUtterance, keepFor, type Utterance } from '../../../src/domain/Session/UseTranscript.js'

describe('collectUtterance', () => {
  it('garde ce que l agent a dit', () => {
    expect(
      collectUtterance({
        name: 'session.assistant',
        payload: { text: 'je propose trois stories', reference: 'FORGE-1', phase: 'spec' },
      }),
    ).toMatchObject({ text: 'je propose trois stories', reference: 'FORGE-1', phase: 'spec' })
  })

  it('ecarte un evenement qui ne vient pas d une session', () => {
    expect(collectUtterance({ name: 'story.written', payload: { text: 'coucou' } })).toBeNull()
  })

  it('ecarte un tour sans rien a montrer, pour ne pas remplir l ecran de vide', () => {
    expect(collectUtterance({ name: 'session.system', payload: { reference: 'FORGE-1' } })).toBeNull()
  })

  it('annonce le lancement avec des mots, pas une bulle vide', () => {
    expect(collectUtterance({ name: 'session.dispatched', payload: { phase: 'spec' } })).toMatchObject({
      name: 'session.dispatched',
      text: null,
      textKey: 'story.dispatched',
    })
  })

  it('garde une panne de session et son motif', () => {
    expect(
      collectUtterance({ name: 'session.failed', payload: { message: 'le runner a disparu' } }),
    ).toMatchObject({ text: 'le runner a disparu' })
  })

  it('garde un tour qui ne porte que le cout', () => {
    expect(collectUtterance({ name: 'session.result', payload: { costUsd: 0.42 } })).toMatchObject({
      costUsd: 0.42,
    })
  })

  it('ecarte un texte blanc', () => {
    expect(collectUtterance({ name: 'session.assistant', payload: { text: '   ' } })).toBeNull()
  })
})

describe('keepFor', () => {
  const HISTORIQUE: Utterance[] = [
    {
      name: 'session.assistant',
      reference: 'FORGE-1',
      phase: 'spec',
      text: 'un',
      textKey: null,
      costUsd: null,
    },
    {
      name: 'session.assistant',
      reference: 'FORGE-2',
      phase: 'spec',
      text: 'deux',
      textKey: null,
      costUsd: null,
    },
    {
      name: 'session.dispatched',
      reference: null,
      phase: 'spec',
      text: null,
      textKey: 'story.dispatched',
      costUsd: null,
    },
  ]

  it('garde tout quand aucune story n est ouverte', () => {
    expect(keepFor(HISTORIQUE, null)).toHaveLength(3)
  })

  it('ne montre pas le travail d une autre story', () => {
    expect(keepFor(HISTORIQUE, 'FORGE-1').map((utterance) => utterance.text)).toEqual(['un', null])
  })
})
