import { describe, expect, it } from 'vitest'
import { LEADER, resolveStroke, type Stroke } from '../../../src/technical/Router/Shortcut.js'

function stroke(key: string, held: Partial<Stroke> = {}): Stroke {
  return { key, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...held }
}

describe('la touche de tete', () => {
  it('est le g, comme aller a', () => {
    expect(LEADER).toBe('g')
  })

  it('s arme sans deplacer personne', () => {
    expect(resolveStroke(stroke('g'), false)).toEqual({ path: null, armed: true })
  })

  it('mene a l ecran de la lettre qui suit', () => {
    expect(resolveStroke(stroke('k'), true)).toEqual({ path: '/kanban', armed: false })
  })

  it('se desarme sur une lettre qui ne mene nulle part', () => {
    expect(resolveStroke(stroke('z'), true)).toEqual({ path: null, armed: false })
  })

  it('se desarme sur echappe', () => {
    expect(resolveStroke(stroke('Escape'), true)).toEqual({ path: null, armed: false })
  })

  it('ne fait rien sur une lettre seule quand rien n est arme', () => {
    expect(resolveStroke(stroke('k'), false)).toEqual({ path: null, armed: false })
  })

  it('ne s arme pas quand une touche de commande est tenue', () => {
    expect(resolveStroke(stroke('g', { ctrlKey: true }), false)).toEqual({ path: null, armed: false })
  })
})

describe('le raccourci direct', () => {
  it('mene a l ecran avec alt et majuscule', () => {
    expect(resolveStroke(stroke('k', { altKey: true, shiftKey: true }), false)).toEqual({
      path: '/kanban',
      armed: false,
    })
  })

  it('refuse alt seul, on tape des caracteres avec', () => {
    expect(resolveStroke(stroke('k', { altKey: true }), false)).toEqual({ path: null, armed: false })
  })

  it('refuse ctrl et alt, c est l altgr du clavier francais', () => {
    expect(resolveStroke(stroke('e', { ctrlKey: true, altKey: true }), false)).toEqual({
      path: null,
      armed: false,
    })
  })

  it('refuse la touche windows, le systeme la garde pour lui', () => {
    expect(resolveStroke(stroke('e', { metaKey: true }), false)).toEqual({ path: null, armed: false })
  })

  it('desarme la tete quand il sert', () => {
    expect(resolveStroke(stroke('v', { altKey: true, shiftKey: true }), true)).toEqual({
      path: '/view',
      armed: false,
    })
  })
})
