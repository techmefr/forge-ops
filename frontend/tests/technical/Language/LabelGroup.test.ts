import { describe, expect, it } from 'vitest'
import { HUMAN_GATE_STATES, STORY_STATE_SEQUENCE } from '@contract/StoryContract'
import { LANGUAGES } from '@/technical/Language/Language'
import { LABEL_GROUPS } from '@/domain/Board/LabelGroup'
import { MESSAGES } from '@/technical/Language/Locale/Locales'

type Branch = { [key: string]: string | Branch }

function branchAt(root: Branch, path: string): Branch {
  return path.split('.').reduce<Branch>((node, part) => node[part] as Branch, root)
}

function labelOf(entry: string | Branch): string {
  return typeof entry === 'string' ? entry : ((entry.label as string) ?? '')
}

describe('chaque valeur de contrat porte un libelle dans chaque langue', () => {
  for (const [group, sequence] of Object.entries(LABEL_GROUPS)) {
    for (const language of LANGUAGES) {
      it(`nomme chaque ${group} en ${language}`, () => {
        const branch = branchAt(MESSAGES[language] as unknown as Branch, group)
        const unnamed = sequence.filter((value) => labelOf(branch[value] ?? '').trim() === '')
        expect(unnamed).toEqual([])
      })
    }
  }
})

describe('les groupes de libelles suivent les sequences', () => {
  it('ne garde aucun groupe vide', () => {
    const empty = Object.entries(LABEL_GROUPS).filter(([, sequence]) => sequence.length === 0)
    expect(empty).toEqual([])
  })

  it('ne laisse aucun libelle orphelin dans un groupe ferme', () => {
    const closed = ['state', 'checkpoint', 'lens', 'phase', 'lifecycle', 'outcome']
    for (const group of closed) {
      const branch = branchAt(MESSAGES.en as unknown as Branch, group)
      expect(Object.keys(branch).sort()).toEqual([...(LABEL_GROUPS[group] ?? [])].sort())
    }
  })
})

describe('les portes humaines empruntent les libelles d etat', () => {
  it('ne nomme qu un etat de story, deja traduit', () => {
    const stray = HUMAN_GATE_STATES.filter(
      (state) => !(STORY_STATE_SEQUENCE as readonly string[]).includes(state),
    )
    expect(stray).toEqual([])
  })
})
