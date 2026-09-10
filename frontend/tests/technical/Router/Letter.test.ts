import { describe, expect, it } from 'vitest'
import { assignLetters, screenOfLetter } from '../../../src/technical/Router/Letter.js'
import { SCREENS } from '../../../src/technical/Router/Screen.js'

describe('assignLetters', () => {
  it('prend l initiale quand elle est libre', () => {
    expect(assignLetters(['Story', 'Backlog', 'Kanban'])).toEqual(['S', 'B', 'K'])
  })

  it('passe a la lettre suivante libre quand l initiale est prise', () => {
    expect(assignLetters(['Review', 'Ressources'])).toEqual(['R', 'E'])
  })

  it('sert le premier arrive', () => {
    expect(assignLetters(['Ressources', 'Review'])).toEqual(['R', 'E'])
  })

  it('ignore la casse du libelle', () => {
    expect(assignLetters(['projet'])).toEqual(['P'])
  })

  it('ne rend jamais deux fois la meme lettre', () => {
    const letters = assignLetters(SCREENS.map((screen) => screen.label))

    expect(new Set(letters).size).toBe(letters.length)
  })
})

describe('les lettres du rail', () => {
  it('suivent la regle, sans etre ecrites a la main de travers', () => {
    expect(SCREENS.map((screen) => screen.letter)).toEqual(
      assignLetters(SCREENS.map((screen) => screen.label)),
    )
  })

  it('donnent une lettre a chaque ecran', () => {
    for (const screen of SCREENS) {
      expect(screen.letter).toMatch(/^[A-Z]$/)
    }
  })
})

describe('screenOfLetter', () => {
  it('trouve l ecran d une lettre', () => {
    expect(screenOfLetter('K')?.key).toBe('kanban')
  })

  it('accepte la minuscule, on ne tape pas en majuscule', () => {
    expect(screenOfLetter('k')?.key).toBe('kanban')
  })

  it('rend nul sur une lettre qui ne mene nulle part', () => {
    expect(screenOfLetter('z')).toBeNull()
  })

  it('rend nul sur autre chose qu une lettre', () => {
    expect(screenOfLetter('Enter')).toBeNull()
  })
})
