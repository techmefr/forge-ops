import { describe, expect, it } from 'vitest'
import { saidWhen } from '@/domain/Kanban/Moment'

const NOW = new Date('2026-09-11T12:00:00Z')

describe('saidWhen', () => {
  it('dit a l instant sous la minute', () => {
    expect(saidWhen('2026-09-11 11:59:40', NOW).said?.key).toBe('moment.justNow')
  })

  it('compte les minutes en dessous d une heure', () => {
    expect(saidWhen('2026-09-11 11:18:00', NOW).said).toEqual({
      key: 'moment.minutesAgo',
      values: { count: 42 },
      count: null,
    })
  })

  it('compte les heures dans la journee', () => {
    expect(saidWhen('2026-09-11 05:00:00', NOW).said).toEqual({
      key: 'moment.hoursAgo',
      values: { count: 7 },
      count: null,
    })
  })

  it('rend la date brute passe un jour, la vue la met dans le fuseau du lecteur', () => {
    const moment = saidWhen('2026-09-08 16:47:00', NOW)

    expect(moment.said).toBeNull()
    expect(moment.date?.toISOString()).toBe('2026-09-08T16:47:00.000Z')
  })

  it('avoue une date illisible plutot que de mentir', () => {
    expect(saidWhen('pas une date', NOW).said?.key).toBe('moment.unknown')
  })
})
