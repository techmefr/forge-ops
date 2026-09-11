import { describe, expect, it } from 'vitest'
import {
  describeSurvivor,
  filesWorthMutating,
  survivorsOf,
} from '../../../src/domain/Mutation/MutationVerdict.js'
import type { MutationOutcome } from '../../../src/domain/Mutation/Mutation.js'

const KILLED: MutationOutcome = { path: 'a.ts', operator: 'boolean_literal', line: 3, killed: true }
const SURVIVOR: MutationOutcome = { path: 'b.ts', operator: 'strict_comparison', line: 7, killed: false }

describe('survivorsOf', () => {
  it('keeps only the mutations the tests failed to kill', () => {
    expect(survivorsOf([KILLED, SURVIVOR])).toEqual([SURVIVOR])
  })
})

describe('describeSurvivor', () => {
  it('names the path, the line and the operator of a survivor', () => {
    expect(describeSurvivor(SURVIVOR)).toBe('b.ts:7 strict_comparison')
  })
})

describe('filesWorthMutating', () => {
  it('ignores test files', () => {
    expect(filesWorthMutating(['src/Thing.ts', 'tests/Thing.test.ts'])).toEqual(['src/Thing.ts'])
  })

  it('ignores files that are not typescript sources', () => {
    expect(filesWorthMutating(['src/Thing.ts', 'db/schema.sql', 'frontend/src/Board.vue'])).toEqual([
      'src/Thing.ts',
    ])
  })

  it('caps the files a run may mutate', () => {
    const paths = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts']

    expect(filesWorthMutating(paths, 2)).toEqual(['a.ts', 'b.ts'])
  })

  it('drops duplicate paths', () => {
    expect(filesWorthMutating(['a.ts', 'a.ts'])).toEqual(['a.ts'])
  })
})
