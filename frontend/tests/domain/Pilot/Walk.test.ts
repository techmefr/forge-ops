import { describe, expect, it } from 'vitest'
import { describeStep, nextStepOf, progressOf, shotUrlOf } from '@/domain/Pilot/Walk'
import type { PilotRun, PilotStep } from '@/domain/Board/BoardModel'

const SCRIPT: readonly PilotStep[] = [
  { kind: 'goto', target: 'http://localhost:5049/mails' },
  { kind: 'click', target: '#compose' },
  { kind: 'expectText', target: 'main', value: 'Nouveau mail' },
]

function run(position: number, state: PilotRun['state'] = 'running'): PilotRun {
  return {
    id: 1,
    storyId: 1,
    storyReference: 'FORGE-1',
    url: 'http://localhost:5049/mails',
    pace: 'slow',
    state,
    position,
    script: SCRIPT,
    acts: [],
    startedAt: '2026-09-09 18:00:00',
    endedAt: null,
  }
}

describe('progressOf', () => {
  it('est a zero avant le premier pas', () => {
    expect(progressOf(run(0)).percent).toBe(0)
  })

  it('compte les pas deja marches', () => {
    expect(progressOf(run(2))).toMatchObject({ done: 2, total: 3 })
  })

  it('est a cent quand le parcours est fini', () => {
    expect(progressOf(run(3)).percent).toBe(100)
  })

  it('ne divise pas par zero sur un parcours vide', () => {
    expect(progressOf({ ...run(0), script: [] }).percent).toBe(0)
  })

  it('rend zero quand il n y a aucun parcours', () => {
    expect(progressOf(null)).toMatchObject({ done: 0, total: 0, percent: 0 })
  })
})

describe('nextStepOf', () => {
  it('annonce le prochain pas', () => {
    expect(nextStepOf(run(1))).toEqual(SCRIPT[1])
  })

  it('n annonce rien quand tout est marche', () => {
    expect(nextStepOf(run(3))).toBeNull()
  })

  it('n annonce rien quand le parcours est termine, meme au milieu', () => {
    expect(nextStepOf(run(1, 'failed'))).toBeNull()
  })

  it('n annonce rien sans parcours', () => {
    expect(nextStepOf(null)).toBeNull()
  })
})

describe('describeStep', () => {
  it('dit ou il va', () => {
    expect(describeStep({ kind: 'goto', target: 'http://x.test/' })).toContain('http://x.test/')
  })

  it('dit sur quoi il clique', () => {
    expect(describeStep({ kind: 'click', target: '#compose' })).toBe('Clique sur #compose')
  })

  it('dit ce qu il ecrit et ou', () => {
    expect(describeStep({ kind: 'fill', target: '#objet', value: 'Bonjour' })).toBe(
      'Ecrit « Bonjour » dans #objet',
    )
  })

  it('dit le texte qu il attend', () => {
    expect(describeStep({ kind: 'expectText', target: 'main', value: 'Nouveau mail' })).toBe(
      'Verifie que main dit « Nouveau mail »',
    )
  })

  it('dit qu il regarde', () => {
    expect(describeStep({ kind: 'screenshot' })).toBe('Capture l ecran')
  })
})

describe('shotUrlOf', () => {
  it('ne garde que le nom du fichier, le board sert le dossier', () => {
    expect(shotUrlOf('/tmp/forge-shots/pilot-17-3.png')).toBe('/api/pilots/shots/pilot-17-3.png')
  })

  it('accepte un chemin windows', () => {
    expect(shotUrlOf('C:/shots/pilot-1-1.png')).toBe('/api/pilots/shots/pilot-1-1.png')
  })

  it('accepte un nom nu', () => {
    expect(shotUrlOf('pilot-1-1.png')).toBe('/api/pilots/shots/pilot-1-1.png')
  })

  it('ne fabrique pas une adresse a partir de rien', () => {
    expect(shotUrlOf('')).toBe('/api/pilots/shots/')
  })
})
