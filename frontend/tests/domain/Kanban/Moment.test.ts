import { describe, expect, it } from 'vitest'
import { saidWhen } from '@/domain/Kanban/Moment'

const NOW = new Date('2026-09-11T12:00:00Z')

describe('saidWhen', () => {
  it('dit a l instant sous la minute', () => {
    expect(saidWhen('2026-09-11 11:59:40', NOW)).toBe('a l instant')
  })

  it('compte les minutes en dessous d une heure', () => {
    expect(saidWhen('2026-09-11 11:18:00', NOW)).toBe('il y a 42 min')
  })

  it('compte les heures dans la journee', () => {
    expect(saidWhen('2026-09-11 05:00:00', NOW)).toBe('il y a 7 h')
  })

  it('donne la date passe un jour, dans le fuseau de qui lit', () => {
    expect(saidWhen('2026-09-08 16:47:00', NOW)).toBe('le 08/09 a 18:47')
  })

  it('avoue une date illisible plutot que de mentir', () => {
    expect(saidWhen('pas une date', NOW)).toBe('date inconnue')
  })
})
