import { describe, expect, it } from 'vitest'
import {
  centreOf,
  clampProgress,
  moveOf,
  pulsesOf,
  spotAt,
  travelled,
  travelMillisOf,
} from '@/domain/Tour/TourGesture'

const BOX = { left: 100, top: 40, width: 200, height: 60 }

describe('le geste remplace la prose', () => {
  it('vise le centre de ce qu il montre', () => {
    expect(centreOf(BOX)).toEqual({ x: 200, y: 70 })
  })

  it('part de sa cible quand il n a pas de position precedente', () => {
    const move = moveOf(null, { x: 10, y: 20 }, 'point')
    expect(move.from).toEqual(move.to)
    expect(travelled(move)).toBe(false)
  })

  it('garde le depart quand il vient d ailleurs', () => {
    const move = moveOf({ x: 0, y: 0 }, { x: 10, y: 20 }, 'point')
    expect(travelled(move)).toBe(true)
  })
})

describe('un mouvement commence sur sa source et finit sur sa cible', () => {
  for (const gesture of ['point', 'sweep', 'open'] as const) {
    it('ne derive pas aux deux bouts en ' + gesture, () => {
      const move = moveOf({ x: 0, y: 0 }, { x: 400, y: 200 }, gesture)
      expect(spotAt(move, 0)).toEqual({ x: 0, y: 0 })
      expect(spotAt(move, 1)).toEqual({ x: 400, y: 200 })
    })
  }

  it('bombe la trajectoire du balayage au lieu de la tirer droit', () => {
    const move = moveOf({ x: 0, y: 0 }, { x: 600, y: 0 }, 'sweep')
    expect(spotAt(move, 0.5).y).toBeLessThan(0)
  })

  it('depasse puis revient quand il ouvre', () => {
    const move = moveOf({ x: 0, y: 0 }, { x: 100, y: 0 }, 'open')
    expect(spotAt(move, 0.5).x).toBeGreaterThan(50)
  })

  it('ramene une progression aberrante dans ses bornes', () => {
    expect(clampProgress(-3)).toBe(0)
    expect(clampProgress(Number.NaN)).toBe(1)
    expect(clampProgress(9)).toBe(1)
  })
})

describe('le mouvement se tait quand on le lui demande', () => {
  it('ne voyage ni ne pulse en mouvement reduit', () => {
    for (const gesture of ['point', 'sweep', 'open'] as const) {
      expect(travelMillisOf(gesture, true)).toBe(0)
      expect(pulsesOf(gesture, true)).toBe(0)
    }
  })

  it('prend son temps sinon, et plus longtemps pour balayer que pour pointer', () => {
    expect(travelMillisOf('sweep', false)).toBeGreaterThan(travelMillisOf('point', false))
    expect(pulsesOf('open', false)).toBeGreaterThan(0)
  })
})
