import { describe, expect, it } from 'vitest'
import { eventDraftSchema, hasMinutes, isCalendarDate, minutesToWrite } from '../../../../contract/EventContract.js'

describe('minutes to write', () => {
  it('flags an event dated before today with no minutes', () => {
    expect(minutesToWrite({ date: '2026-09-28', minutes: null }, '2026-09-29')).toBe(true)
    expect(minutesToWrite({ date: '2026-09-28', minutes: '  \n' }, '2026-09-29')).toBe(true)
  })

  it('does not flag an event dated today or later', () => {
    expect(minutesToWrite({ date: '2026-09-29', minutes: null }, '2026-09-29')).toBe(false)
    expect(minutesToWrite({ date: '2026-10-01', minutes: null }, '2026-09-29')).toBe(false)
  })

  it('does not flag a past event whose minutes are written', () => {
    expect(minutesToWrite({ date: '2026-09-01', minutes: 'Decided' }, '2026-09-29')).toBe(false)
    expect(hasMinutes({ minutes: 'Decided' })).toBe(true)
    expect(hasMinutes({ minutes: null })).toBe(false)
  })
})

describe('calendar dates', () => {
  it('accepts real dates including a leap day', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true)
    expect(isCalendarDate('2028-02-29')).toBe(true)
  })

  it('rejects impossible dates', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false)
    expect(isCalendarDate('2027-02-29')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
    expect(isCalendarDate('2026-00-10')).toBe(false)
    expect(isCalendarDate('2026-04-31')).toBe(false)
  })

  it('rejects malformed dates', () => {
    expect(isCalendarDate('2026-2-3')).toBe(false)
    expect(isCalendarDate('tomorrow')).toBe(false)
  })

  it('refuses an impossible date in a draft', () => {
    const draft = eventDraftSchema.safeParse({ type: 'demo', date: '2026-02-30', title: 'bad', projectId: 1 })

    expect(draft.success).toBe(false)
  })
})
