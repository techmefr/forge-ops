import { describe, expect, it } from 'vitest'
import { TOUR_GESTURES } from '../../../../contract/TourContract'
import { TOUR_STEPS } from '@/domain/Tour/TourStep'
import {
  clampIndex,
  isFirstStep,
  isLastStep,
  nextIndex,
  previousIndex,
  readMemory,
  shouldOpen,
  stepAt,
  tourLength,
  writeMemory,
} from '@/domain/Tour/TourWalk'

describe('la visite est une liste ordonnee, pas de la prose dans les composants', () => {
  it('donne a chaque etape un ancrage, un geste et deux cles de copie', () => {
    for (const step of TOUR_STEPS) {
      expect(step.anchor).not.toBe('')
      expect(step.path.startsWith('/')).toBe(true)
      expect(step.titleKey).toBe(`tour.${step.id}.title`)
      expect(step.sayKey).toBe(`tour.${step.id}.say`)
      expect(TOUR_GESTURES).toContain(step.gesture)
    }
  })

  it('ne repete jamais le meme identifiant d etape', () => {
    const identifiers = TOUR_STEPS.map((step) => step.id)
    expect(new Set(identifiers).size).toBe(identifiers.length)
  })

  it('passe par les quatre ecrans de la refonte', () => {
    expect(TOUR_STEPS.map((step) => step.id)).toEqual([
      'pipeline',
      'column',
      'story',
      'mine',
      'evidence',
      'guardrail',
      'ledger',
      'rules',
    ])
  })

  it('ne laisse aucun ecran hors de la visite', () => {
    const screens = new Set(TOUR_STEPS.map((step) => step.path.split('/')[1]))
    expect([...screens].sort()).toEqual(['me', 'projects', 'settings', 'statistics'])
  })
})

describe('le parcours ne sort jamais des bornes', () => {
  it('ramene un index negatif ou fantaisiste sur la premiere etape', () => {
    expect(clampIndex(-4)).toBe(0)
    expect(clampIndex(Number.NaN)).toBe(0)
  })

  it('ramene un index trop grand sur la derniere etape', () => {
    expect(clampIndex(99)).toBe(tourLength() - 1)
  })

  it('avance et recule d une etape a la fois', () => {
    expect(nextIndex(0)).toBe(1)
    expect(previousIndex(2)).toBe(1)
    expect(previousIndex(0)).toBe(0)
    expect(nextIndex(tourLength() - 1)).toBe(tourLength() - 1)
  })

  it('reconnait la premiere et la derniere etape', () => {
    expect(isFirstStep(0)).toBe(true)
    expect(isLastStep(tourLength() - 1)).toBe(true)
    expect(isLastStep(0)).toBe(false)
  })

  it('rend l etape demandee', () => {
    expect(stepAt(1)?.id).toBe('column')
    expect(stepAt(500)?.id).toBe('rules')
  })
})

describe('la visite ne se declenche que sur un board de demonstration', () => {
  const fresh = { state: 'pending', index: 0 } as const

  it('accueille le visiteur en mode demo', () => {
    expect(shouldOpen({ environment: 'demo', optIn: false, memory: fresh })).toBe(true)
  })

  it('laisse un vrai board tranquille', () => {
    expect(shouldOpen({ environment: 'real', optIn: false, memory: fresh })).toBe(false)
  })

  it('ouvre un vrai board seulement sur demande explicite', () => {
    expect(shouldOpen({ environment: 'real', optIn: true, memory: fresh })).toBe(true)
  })

  it('ne revient pas apres un renvoi, meme en demo', () => {
    expect(
      shouldOpen({ environment: 'demo', optIn: true, memory: { state: 'closed', index: 3 } }),
    ).toBe(false)
  })
})

describe('la visite se reprend la ou elle a ete laissee', () => {
  it('relit l etat et la position ecrits', () => {
    expect(readMemory(writeMemory({ state: 'running', index: 2 }))).toEqual({
      state: 'running',
      index: 2,
    })
  })

  it('repart du debut sans souvenir', () => {
    expect(readMemory(null)).toEqual({ state: 'pending', index: 0 })
  })

  it('ignore un souvenir abime', () => {
    expect(readMemory('n importe quoi:7')).toEqual({ state: 'pending', index: 0 })
    expect(readMemory('running:abc')).toEqual({ state: 'running', index: 0 })
  })
})
