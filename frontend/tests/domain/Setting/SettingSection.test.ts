import { describe, expect, it } from 'vitest'
import {
  SETTING_EFFECTS,
  SETTING_SECTIONS,
  effectOf,
  keepsTheOrganisation,
  sectionsOf,
} from '../../../src/domain/Setting/SettingSection.js'

describe('les sections de reglages', () => {
  it('annoncent toutes quand le changement prend effet', () => {
    const silent = SETTING_SECTIONS.filter(
      (section) => !(SETTING_EFFECTS as readonly string[]).includes(section.effect),
    )

    expect(silent).toEqual([])
  })

  it('ne repetent jamais la meme section', () => {
    expect(new Set(SETTING_SECTIONS.map((section) => section.key)).size).toBe(
      SETTING_SECTIONS.length,
    )
  })

  it('separent ce qui appartient a la personne de ce qui appartient a l organisation', () => {
    expect(sectionsOf('mine').map((section) => section.key)).toEqual(['appearance', 'account'])
    expect(sectionsOf('organisation').map((section) => section.key)).toEqual([
      'templates',
      'budget',
      'organisation',
      'delivery',
    ])
  })

  it('donnent l effet d une section connue, et rien d une section inconnue', () => {
    expect(effectOf('appearance')).toBe('immediate')
    expect(effectOf('nawak')).toBeNull()
  })
})

describe('keepsTheOrganisation', () => {
  it('ouvre la moitie admin au directeur', () => {
    expect(keepsTheOrganisation('director', false)).toBe(true)
  })

  it('la ferme a l architecte, qui travaille dedans sans la regler', () => {
    expect(keepsTheOrganisation('architect', false)).toBe(false)
  })

  it('l ouvre a qui tient un board seul, sans compte a qui demander', () => {
    expect(keepsTheOrganisation(null, true)).toBe(true)
  })

  it('la ferme quand on ne sait ni qui regarde ni s il est seul', () => {
    expect(keepsTheOrganisation(null, false)).toBe(false)
  })
})
