import { describe, expect, it } from 'vitest'
import { suggestParcours } from '../../../src/domain/Pilot/Parcours.js'

const CRITERIA = [
  { reference: 'AC-1', statement: 'la liste affiche vingt mails par page' },
  { reference: 'AC-2', statement: 'une page inexistante est refusee' },
]

describe('a story with no worktree', () => {
  it('suggests no address, there is nothing running to look at', () => {
    expect(suggestParcours({ port: null, criteria: CRITERIA }).url).toBe('')
  })

  it('suggests no parcours either', () => {
    expect(suggestParcours({ port: null, criteria: CRITERIA }).script).toEqual([])
  })

  it('says why, so the screen can tell the human to open a worktree', () => {
    expect(suggestParcours({ port: null, criteria: CRITERIA }).reason).toBe('noWorktree')
  })
})

describe('a story whose worktree is up', () => {
  it('suggests the address of its own port', () => {
    expect(suggestParcours({ port: 5049, criteria: CRITERIA }).url).toBe('http://localhost:5049/')
  })

  it('opens the parcours on that address', () => {
    expect(suggestParcours({ port: 5049, criteria: CRITERIA }).script[0]).toEqual({
      kind: 'goto',
      target: 'http://localhost:5049/',
    })
  })

  it('adds one look per acceptance criterion, that is what has to be proven', () => {
    expect(suggestParcours({ port: 5049, criteria: CRITERIA }).script).toHaveLength(3)
  })

  it('looks, rather than guessing a selector nobody declared', () => {
    expect(suggestParcours({ port: 5049, criteria: CRITERIA }).script[1]).toEqual({
      kind: 'screenshot',
    })
  })

  it('names the criteria it will walk through', () => {
    const suggestion = suggestParcours({ port: 5049, criteria: CRITERIA })

    expect(suggestion.reason).toBe('onePerCriterion')
    expect(suggestion.references).toEqual(['AC-1', 'AC-2'])
  })
})

describe('a story with no criterion', () => {
  it('still opens the page, a look is better than nothing', () => {
    expect(suggestParcours({ port: 5049, criteria: [] }).script).toEqual([
      { kind: 'goto', target: 'http://localhost:5049/' },
      { kind: 'screenshot' },
    ])
  })

  it('says the criteria are missing rather than pretending', () => {
    expect(suggestParcours({ port: 5049, criteria: [] }).reason).toBe('noCriteria')
  })
})
