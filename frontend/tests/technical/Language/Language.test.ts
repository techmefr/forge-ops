import { describe, expect, it } from 'vitest'
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  SHELL_KEYS,
  screenTextOf,
  shellTextOf,
} from '../../../src/technical/Language/Language.js'
import { SCREENS } from '../../../src/technical/Router/Screen.js'

describe('les langues proposees', () => {
  it('propose le francais et l anglais', () => {
    expect([...LANGUAGES]).toEqual(['fr', 'en'])
  })

  it('nomme chaque langue dans sa propre langue', () => {
    expect(LANGUAGE_LABELS.fr).toBe('Francais')
    expect(LANGUAGE_LABELS.en).toBe('English')
  })
})

describe('screenTextOf', () => {
  it('rend le libelle francais du kanban', () => {
    expect(screenTextOf('kanban', 'fr').label).toBe('Kanban')
  })

  it('traduit le libelle du projet', () => {
    expect(screenTextOf('project', 'en').label).toBe('Project')
  })

  it('traduit aussi la ligne d explication', () => {
    expect(screenTextOf('project', 'en').sub).not.toBe(screenTextOf('project', 'fr').sub)
  })

  it('couvre chaque ecran dans chaque langue', () => {
    for (const screen of SCREENS) {
      for (const language of LANGUAGES) {
        expect(screenTextOf(screen.key, language).label.length).toBeGreaterThan(0)
        expect(screenTextOf(screen.key, language).sub.length).toBeGreaterThan(0)
      }
    }
  })

  it('garde le francais de Screen comme source', () => {
    for (const screen of SCREENS) {
      expect(screenTextOf(screen.key, 'fr')).toEqual({ label: screen.label, sub: screen.sub })
    }
  })
})

describe('shellTextOf', () => {
  it('rend le mot francais', () => {
    expect(shellTextOf('settings', 'fr')).toBe('Reglages')
  })

  it('traduit le mot', () => {
    expect(shellTextOf('settings', 'en')).toBe('Settings')
  })

  it('couvre chaque mot du cadre dans chaque langue', () => {
    for (const key of SHELL_KEYS) {
      for (const language of LANGUAGES) {
        expect(shellTextOf(key, language).length).toBeGreaterThan(0)
      }
    }
  })

  it('ne laisse aucun mot du cadre identique par oubli de traduction', () => {
    const untranslated = SHELL_KEYS.filter(
      (key) => shellTextOf(key, 'fr') === shellTextOf(key, 'en'),
    )
    expect(untranslated).toEqual([])
  })
})
