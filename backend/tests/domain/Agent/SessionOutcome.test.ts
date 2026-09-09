import { describe, expect, it } from 'vitest'
import {
  classifyOutcome,
  OUTCOME_CLASSES,
  lifecycleOfOutcome,
} from '../../../src/domain/Agent/SessionOutcome.js'

describe('classifyOutcome', () => {
  it('classe une sortie propre en succes', () => {
    expect(classifyOutcome({ exitCode: 0 }).outcome).toBe('succeeded')
  })

  it('classe une sortie non nulle en echec', () => {
    expect(classifyOutcome({ exitCode: 1 }).outcome).toBe('failed')
  })

  it('classe une interruption par signal', () => {
    expect(classifyOutcome({ exitCode: null, signal: 'SIGINT' }).outcome).toBe('interrupted')
  })

  it('classe un kill dur en tue', () => {
    expect(classifyOutcome({ exitCode: null, signal: 'SIGKILL' }).outcome).toBe('killed')
  })

  it('classe un depassement de temps en timeout', () => {
    expect(classifyOutcome({ exitCode: null, timedOut: true }).outcome).toBe('timed_out')
  })

  it('fait primer le timeout sur le signal qui l a applique', () => {
    expect(classifyOutcome({ exitCode: null, signal: 'SIGTERM', timedOut: true }).outcome).toBe('timed_out')
  })

  it('classe un plafond de cout atteint', () => {
    expect(classifyOutcome({ exitCode: null, reason: 'budget' }).outcome).toBe('budget_exhausted')
  })

  it('classe un refus de permission', () => {
    expect(classifyOutcome({ exitCode: 1, reason: 'permission' }).outcome).toBe('permission_denied')
  })

  it('classe une boucle detectee', () => {
    expect(classifyOutcome({ exitCode: null, reason: 'loop' }).outcome).toBe('looping')
  })

  it('classe une attente humaine', () => {
    expect(classifyOutcome({ exitCode: null, reason: 'human' }).outcome).toBe('awaiting_human')
  })

  it('classe un daemon injoignable', () => {
    expect(classifyOutcome({ exitCode: 127 }).outcome).toBe('runner_missing')
  })

  it('classe une sortie qui n a rien rendu du tout', () => {
    expect(classifyOutcome({ exitCode: null }).outcome).toBe('unknown')
  })

  it('ne rend jamais une classe hors de la liste, meme sur une sortie absurde', () => {
    const outcome = classifyOutcome({ exitCode: -999, signal: 'SIGBIDON' }).outcome

    expect(OUTCOME_CLASSES).toContain(outcome)
  })

  it('garde le code de sortie dans son verdict, pour le journal', () => {
    expect(classifyOutcome({ exitCode: 42 })).toMatchObject({ exitCode: 42 })
  })

  it('explique le verdict en une phrase', () => {
    expect(classifyOutcome({ exitCode: 0 }).statement.length).toBeGreaterThan(0)
  })
})

describe('lifecycleOfOutcome', () => {
  it('traduit un succes en session terminee', () => {
    expect(lifecycleOfOutcome('succeeded')).toBe('finished')
  })

  it('traduit une attente humaine en session en attente', () => {
    expect(lifecycleOfOutcome('awaiting_human')).toBe('awaiting_human')
  })

  it('traduit une interruption en session interrompue', () => {
    expect(lifecycleOfOutcome('interrupted')).toBe('interrupted')
  })

  it('traduit tout le reste en echec plutot qu en succes muet', () => {
    const failing = OUTCOME_CLASSES.filter(
      (outcome) => !['succeeded', 'awaiting_human', 'interrupted', 'killed'].includes(outcome),
    )

    expect(failing.map(lifecycleOfOutcome).every((lifecycle) => lifecycle === 'failed')).toBe(true)
  })

  it('donne une traduction a chacune des classes, sans trou', () => {
    expect(OUTCOME_CLASSES.every((outcome) => lifecycleOfOutcome(outcome).length > 0)).toBe(true)
  })
})
