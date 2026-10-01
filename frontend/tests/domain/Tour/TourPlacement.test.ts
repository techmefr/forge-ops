import { describe, expect, it } from 'vitest'
import { popoverCorner } from '@/domain/Tour/TourPlacement'
import { tagPositionOf } from '@/technical/Ui/Spotlight'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 375, height: 812 }
const POPOVER = { width: 380, height: 260 }

describe('the tour popover', () => {
  it('stays bottom right when nothing is highlighted or the target is elsewhere', () => {
    expect(popoverCorner(null, POPOVER, DESKTOP)).toBe('bottom-right')
    expect(popoverCorner({ left: 20, top: 120, width: 600, height: 300 }, POPOVER, DESKTOP)).toBe('bottom-right')
  })

  it('moves away from a target at the bottom right', () => {
    const target = { left: 1000, top: 600, width: 400, height: 250 }
    expect(popoverCorner(target, POPOVER, DESKTOP)).toBe('bottom-left')
  })

  it('goes to the top on a phone when the target is in the lower part', () => {
    const target = { left: 12, top: 520, width: 351, height: 220 }
    expect(popoverCorner(target, { width: 351, height: 280 }, PHONE)).toMatch(/^top-/)
  })

  it('picks the corner that covers the least when the target fills the screen', () => {
    const target = { left: 0, top: 0, width: 1440, height: 900 }
    expect(popoverCorner(target, POPOVER, DESKTOP)).toBe('bottom-right')
  })
})

describe('the tour tag', () => {
  const TAG = { width: 80, height: 20 }

  it('sits above the target when there is room', () => {
    expect(tagPositionOf({ left: 100, top: 200, width: 300, height: 100 }, TAG, DESKTOP)).toEqual({ left: 108, top: 174 })
  })

  it('goes beside a target that touches the top of the screen when the width allows it', () => {
    expect(tagPositionOf({ left: 100, top: 0, width: 300, height: 50 }, TAG, DESKTOP)).toEqual({ left: 406, top: 4 })
  })

  it('goes below a full width target that touches the top of the screen', () => {
    expect(tagPositionOf({ left: 0, top: 0, width: 1440, height: 50 }, TAG, DESKTOP)).toEqual({ left: 8, top: 56 })
  })

  it('goes inside a target that fills the screen height', () => {
    expect(tagPositionOf({ left: 0, top: 0, width: 1440, height: 900 }, TAG, DESKTOP)).toEqual({ left: 8, top: 6 })
  })

  it('stays inside the viewport horizontally', () => {
    const position = tagPositionOf({ left: 340, top: 300, width: 200, height: 50 }, TAG, PHONE)
    expect(position.left).toBe(291)
    expect(position.left + TAG.width).toBeLessThanOrEqual(PHONE.width)
  })
})
