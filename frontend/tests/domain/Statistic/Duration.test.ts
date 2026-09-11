import { describe, expect, it } from 'vitest'
import { humanDuration } from '@/domain/Statistic/Duration'

describe('humanDuration', () => {
  it('dit qu une session ouverte n a pas de duree', () => {
    expect(humanDuration(null).key).toBe('duration.running')
  })

  it('reste en secondes en dessous d une minute', () => {
    expect(humanDuration(42)).toEqual({
      key: 'duration.seconds',
      values: { count: 42 },
      count: null,
    })
  })

  it('passe aux minutes a partir d une minute', () => {
    expect(humanDuration(60)).toEqual({
      key: 'duration.minutes',
      values: { count: 1 },
      count: null,
    })
  })

  it('garde les secondes restantes', () => {
    expect(humanDuration(95)).toEqual({
      key: 'duration.minutesSeconds',
      values: { minutes: 1, seconds: 35 },
      count: null,
    })
  })

  it('passe aux heures a partir d une heure', () => {
    expect(humanDuration(3600)).toEqual({
      key: 'duration.hours',
      values: { count: 1 },
      count: null,
    })
  })

  it('garde les minutes restantes au dela d une heure', () => {
    expect(humanDuration(5460)).toEqual({
      key: 'duration.hoursMinutes',
      values: { hours: 1, minutes: 31 },
      count: null,
    })
  })

  it('ne traine pas un zero seconde derriere les minutes', () => {
    expect(humanDuration(360).key).toBe('duration.minutes')
  })

  it('garde les secondes quand il en reste', () => {
    expect(humanDuration(365)).toEqual({
      key: 'duration.minutesSeconds',
      values: { minutes: 6, seconds: 5 },
      count: null,
    })
  })
})
