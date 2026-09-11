import { describe, expect, it } from 'vitest'
import { createLatest } from '@/technical/Api/Latest'

describe('createLatest', () => {
  it('reconnait la seule demande en cours', () => {
    const latest = createLatest()
    const ticket = latest.claim()
    expect(latest.isCurrent(ticket)).toBe(true)
  })

  it('perime la demande précédente des qu une nouvelle part', () => {
    const latest = createLatest()
    const first = latest.claim()
    const second = latest.claim()
    expect(latest.isCurrent(first)).toBe(false)
    expect(latest.isCurrent(second)).toBe(true)
  })

  it('garde chaque compteur pour lui', () => {
    const one = createLatest()
    const other = createLatest()
    const ticket = one.claim()
    other.claim()
    expect(one.isCurrent(ticket)).toBe(true)
  })
})
