import { describe, expect, it } from 'vitest'
import {
  ARMED,
  IDLE,
  LEADER,
  resolveStroke,
  type Stroke,
} from '../../../src/technical/Router/Shortcut.js'

function stroke(key: string, held: Partial<Stroke> = {}): Stroke {
  return { key, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...held }
}

describe('la touche de tete', () => {
  it('est le z, une lettre qu on ne double jamais en ecrivant', () => {
    expect(LEADER).toBe('z')
  })

  it('demande deux frappes avant d armer', () => {
    expect(resolveStroke(stroke('z'), IDLE)).toEqual({ path: null, phase: 1 })
  })

  it('arme a la deuxieme', () => {
    expect(resolveStroke(stroke('z'), 1)).toEqual({ path: null, phase: ARMED })
  })

  it('mene a l ecran du chiffre qui suit', () => {
    expect(resolveStroke(stroke('4'), ARMED)).toEqual({ path: '/kanban', phase: IDLE })
  })

  it('retombe quand une seule frappe est suivie d autre chose', () => {
    expect(resolveStroke(stroke('4'), 1)).toEqual({ path: null, phase: IDLE })
  })

  it('ne mene nulle part sur un chiffre seul', () => {
    expect(resolveStroke(stroke('4'), IDLE)).toEqual({ path: null, phase: IDLE })
  })

  it('se desarme sur une touche qui n est pas un chiffre', () => {
    expect(resolveStroke(stroke('k'), ARMED)).toEqual({ path: null, phase: IDLE })
  })

  it('se desarme sur echappe', () => {
    expect(resolveStroke(stroke('Escape'), ARMED)).toEqual({ path: null, phase: IDLE })
  })

  it('accepte la majuscule, le clavier francais chiffre avec la touche des majuscules', () => {
    expect(resolveStroke(stroke('1', { shiftKey: true }), ARMED)).toEqual({
      path: '/story',
      phase: IDLE,
    })
  })

  it('ne compte pas un z tenu avec une touche de commande', () => {
    expect(resolveStroke(stroke('z', { ctrlKey: true }), IDLE)).toEqual({ path: null, phase: IDLE })
  })

  it('ignore la casse de la tete', () => {
    expect(resolveStroke(stroke('Z'), 1)).toEqual({ path: null, phase: ARMED })
  })
})

describe('le raccourci direct', () => {
  it('mene a l ecran avec alt et majuscule', () => {
    expect(resolveStroke(stroke('4', { altKey: true, shiftKey: true }), IDLE)).toEqual({
      path: '/kanban',
      phase: IDLE,
    })
  })

  it('refuse alt seul, on tape des caracteres avec', () => {
    expect(resolveStroke(stroke('4', { altKey: true }), IDLE)).toEqual({ path: null, phase: IDLE })
  })

  it('refuse ctrl et alt, c est l altgr du clavier francais', () => {
    expect(resolveStroke(stroke('4', { ctrlKey: true, altKey: true }), IDLE)).toEqual({
      path: null,
      phase: IDLE,
    })
  })

  it('refuse la touche windows, le systeme la garde pour lui', () => {
    expect(resolveStroke(stroke('4', { metaKey: true }), IDLE)).toEqual({ path: null, phase: IDLE })
  })

  it('remet la tete a zero quand il sert', () => {
    expect(resolveStroke(stroke('7', { altKey: true, shiftKey: true }), 1)).toEqual({
      path: '/view',
      phase: IDLE,
    })
  })
})
