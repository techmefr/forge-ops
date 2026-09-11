import { describe, expect, it } from 'vitest'
import { GLYPHS, glyphOf } from '@/technical/Ui/Glyph'
import { SCREENS } from '@/technical/Router/Screen'

describe('glyphOf', () => {
  it('rend un dessin pour chaque ecran du rail', () => {
    expect(SCREENS.filter((screen) => glyphOf(screen.key) === null)).toEqual([])
  })

  it('rend un dessin pour les reglages et les jauges machine', () => {
    expect(['settings', 'cpu', 'ram', 'disk'].filter((name) => glyphOf(name) === null)).toEqual([])
  })

  it('avoue ne rien connaitre plutot que de rendre un carre vide', () => {
    expect(glyphOf('licorne')).toBeNull()
  })

  it('ne dessine qu avec des traces, jamais du texte', () => {
    expect(Object.values(GLYPHS).every((paths) => paths.every((path) => /^[MLACZmlacz0-9 .,-]+$/.test(path)))).toBe(
      true,
    )
  })
})
