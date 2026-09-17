import { describe, expect, it } from 'vitest'
import { identifiersIn } from '../../../src/domain/Demo/DemoIdentifier.js'

describe('identifiersIn', () => {
  it('finds the identifier of every entity of a listing', () => {
    expect(identifiersIn([[{ id: 1 }, { id: 2 }]])).toEqual(['1', '2'])
  })

  it('reaches identifiers nested under other fields', () => {
    expect(identifiersIn([{ board: { columns: [{ stories: [{ id: 'FORGE-1' }] }] } }])).toEqual([
      'FORGE-1',
    ])
  })

  it('collects the identifiers a story points at, not only its own', () => {
    expect(identifiersIn([{ id: 3, storyId: 4, epicId: 5 }])).toEqual(['3', '4', '5'])
  })

  it('says each identifier once whatever the number of payloads', () => {
    expect(identifiersIn([{ id: 7 }, { storyId: 7 }])).toEqual(['7'])
  })

  it('refuses a value that cannot sit in a path', () => {
    expect(identifiersIn([{ id: '../secret' }, { id: '' }, { id: null }])).toEqual([])
  })

  it('reads a payload that carries no identifier at all', () => {
    expect(identifiersIn([{ mode: 'local' }, null, 'texte', 42])).toEqual([])
  })
})
