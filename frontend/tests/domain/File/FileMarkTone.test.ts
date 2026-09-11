import { describe, expect, it } from 'vitest'
import { MARK_TONES, crumbsOf, toneOf } from '@/domain/File/FileMarkTone'

describe('toneOf', () => {
  it('dit en francais ce que chaque marque veut dire', () => {
    expect(toneOf('planned').label).toBe('Va etre modifie')
    expect(toneOf('created').label).toBe('Sera cree')
    expect(toneOf('ready').label).toBe('Fini, pas encore merge')
    expect(toneOf('deleted').label).toBe('Supprime')
    expect(toneOf('merged').label).toBe('Livre')
  })

  it('reste muet pour un fichier que personne ne touche', () => {
    expect(toneOf('quiet').label).toBe('')
  })

  it('retombe sur le calme plutot que de casser devant une marque inconnue', () => {
    expect(toneOf('licorne')).toEqual(MARK_TONES.quiet)
  })

  it('donne une couleur distincte a chaque marque parlante', () => {
    const dots = ['planned', 'created', 'ready', 'deleted'].map((mark) => toneOf(mark).dot)
    expect(new Set(dots).size).toBe(4)
  })
})

describe('crumbsOf', () => {
  it('rend la racine seule quand on est en haut', () => {
    expect(crumbsOf('')).toEqual([{ label: 'racine', path: '' }])
  })

  it('rend un fil d ariane cliquable', () => {
    expect(crumbsOf('backend/src/domain')).toEqual([
      { label: 'racine', path: '' },
      { label: 'backend', path: 'backend' },
      { label: 'src', path: 'backend/src' },
      { label: 'domain', path: 'backend/src/domain' },
    ])
  })
})
