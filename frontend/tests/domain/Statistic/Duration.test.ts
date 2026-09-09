import { describe, expect, it } from 'vitest'
import { humanDuration } from '../../../src/domain/Statistic/Duration.js'

describe('humanDuration', () => {
  it('dit qu une session ouverte n a pas de duree', () => {
    expect(humanDuration(null)).toBe('en cours')
  })

  it('reste en secondes en dessous d une minute', () => {
    expect(humanDuration(42)).toBe('42 s')
  })

  it('passe aux minutes a partir d une minute', () => {
    expect(humanDuration(60)).toBe('1 min 0 s')
  })

  it('garde les secondes restantes', () => {
    expect(humanDuration(95)).toBe('1 min 35 s')
  })

  it('passe aux heures a partir d une heure', () => {
    expect(humanDuration(3600)).toBe('1 h 0 min')
  })

  it('garde les minutes restantes au dela d une heure', () => {
    expect(humanDuration(5460)).toBe('1 h 31 min')
  })
})
