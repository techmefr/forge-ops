import { describe, expect, it } from 'vitest'
import type { Project } from '@contract/StoryContract'
import { optionKey, optionsOf, stepIndex } from '@/domain/Project/ProjectPickerRule'

function project(id: number, name: string): Project {
  return { id, slug: name.toLowerCase(), name, repositoryUrl: '', integrationBranch: 'main', colour: '#ff3b00', checkoutPath: null }
}

const PROJECTS = [project(1, 'Skera'), project(2, 'Forge Ops'), project(3, 'Éclair')]

describe('optionsOf', () => {
  it('lists every project when nothing is typed, with the all option first when asked', () => {
    const keys = optionsOf({ projects: PROJECTS, query: '', showAll: true, creatable: true }).map(optionKey)
    expect(keys).toEqual(['all', 'project-1', 'project-2', 'project-3'])
  })

  it('filters by what is typed, ignoring case and accents', () => {
    expect(
      optionsOf({ projects: PROJECTS, query: 'ecl', showAll: true, creatable: false }).map(optionKey),
    ).toEqual(['project-3'])
    expect(
      optionsOf({ projects: PROJECTS, query: 'OPS', showAll: false, creatable: false }).map(optionKey),
    ).toEqual(['project-2'])
  })

  it('ends with the create option when the text matches no project exactly', () => {
    const options = optionsOf({ projects: PROJECTS, query: '  Cloud ', showAll: false, creatable: true })
    expect(options[options.length - 1]).toEqual({ kind: 'create', name: 'Cloud' })
  })

  it('offers to create even when other projects contain the text', () => {
    const options = optionsOf({ projects: PROJECTS, query: 'For', showAll: false, creatable: true })
    expect(options.map(optionKey)).toEqual(['project-2', 'create'])
  })

  it('does not offer to create an existing name', () => {
    const options = optionsOf({ projects: PROJECTS, query: 'skera', showAll: false, creatable: true })
    expect(options.map(optionKey)).toEqual(['project-1'])
  })

  it('never offers to create when it is not allowed or nothing is typed', () => {
    expect(optionsOf({ projects: PROJECTS, query: 'zzz', showAll: false, creatable: false })).toEqual([])
    expect(optionsOf({ projects: [], query: '', showAll: false, creatable: true })).toEqual([])
  })
})

describe('stepIndex', () => {
  it('moves and wraps', () => {
    expect(stepIndex(-1, 3, 1)).toBe(0)
    expect(stepIndex(-1, 3, -1)).toBe(2)
    expect(stepIndex(2, 3, 1)).toBe(0)
    expect(stepIndex(0, 3, -1)).toBe(2)
    expect(stepIndex(0, 0, 1)).toBe(-1)
  })
})
