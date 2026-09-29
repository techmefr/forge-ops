import { describe, expect, it } from 'vitest'
import { hasMinutes, minutesToWrite } from '../../../../contract/EventContract.js'

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
