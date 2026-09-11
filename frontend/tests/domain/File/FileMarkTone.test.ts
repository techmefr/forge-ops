import { describe, expect, it } from 'vitest'
import { FILE_MARK_SEQUENCE, MARK_TONES, SPOKEN_MARKS, crumbsOf, toneOf } from '@/domain/File/FileMarkTone'

describe('toneOf', () => {
  it('retombe sur le calme plutot que de casser devant une marque inconnue', () => {
    expect(toneOf('licorne')).toEqual(MARK_TONES.quiet)
  })

  it('donne une couleur distincte a chaque marque parlante', () => {
    const dots = ['planned', 'created', 'ready', 'deleted'].map((mark) => toneOf(mark).dot)
    expect(new Set(dots).size).toBe(4)
  })

  it('donne un ton a chaque marque du contrat', () => {
    for (const mark of FILE_MARK_SEQUENCE) {
      expect(toneOf(mark).mark).toBe(mark)
    }
  })
})

describe('SPOKEN_MARKS', () => {
  it('laisse le fichier calme sans rien dire', () => {
    expect(SPOKEN_MARKS).not.toContain('quiet')
  })

  it('garde toutes les autres marques', () => {
    expect([...SPOKEN_MARKS]).toEqual(FILE_MARK_SEQUENCE.filter((mark) => mark !== 'quiet'))
  })
})

describe('crumbsOf', () => {
  it('rend la racine seule quand on est en haut', () => {
    expect(crumbsOf('')).toEqual([{ label: '', path: '', root: true }])
  })

  it('rend un fil d ariane cliquable', () => {
    expect(crumbsOf('backend/src/domain')).toEqual([
      { label: '', path: '', root: true },
      { label: 'backend', path: 'backend', root: false },
      { label: 'src', path: 'backend/src', root: false },
      { label: 'domain', path: 'backend/src/domain', root: false },
    ])
  })
})
