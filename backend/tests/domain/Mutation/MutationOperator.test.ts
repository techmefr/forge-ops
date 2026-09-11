import { describe, expect, it } from 'vitest'
import { mutationsOfSource } from '../../../src/domain/Mutation/MutationOperator.js'

describe('mutationsOfSource', () => {
  it('flips a boolean literal one occurrence at a time', () => {
    const mutations = mutationsOfSource('a.ts', 'const ok = true\nconst no = false\n')

    expect(mutations.map((mutation) => mutation.source)).toEqual([
      'const ok = false\nconst no = false\n',
      'const ok = true\nconst no = true\n',
    ])
  })

  it('inverts a strict comparison', () => {
    const mutations = mutationsOfSource('a.ts', 'if (left === right) { stop() }')

    expect(mutations).toHaveLength(1)
    expect(mutations[0]?.operator).toBe('strict_comparison')
    expect(mutations[0]?.source).toBe('if (left !== right) { stop() }')
  })

  it('drops a negation without touching an inequality', () => {
    const mutations = mutationsOfSource('a.ts', 'if (!ready) { wait() }\nif (a != b) { stop() }')

    expect(mutations).toHaveLength(1)
    expect(mutations[0]?.operator).toBe('dropped_negation')
    expect(mutations[0]?.source).toBe('if (ready) { wait() }\nif (a != b) { stop() }')
  })

  it('replaces a returned expression with undefined', () => {
    const mutations = mutationsOfSource('a.ts', 'function total(a, b) {\n  return a + b\n}\n')

    expect(mutations).toHaveLength(1)
    expect(mutations[0]?.operator).toBe('void_return')
    expect(mutations[0]?.source).toBe('function total(a, b) {\n  return undefined\n}\n')
  })

  it('reports the path and the line of each mutation', () => {
    const mutations = mutationsOfSource('src/Thing.ts', 'const a = 1\nconst ok = true\n')

    expect(mutations[0]?.path).toBe('src/Thing.ts')
    expect(mutations[0]?.line).toBe(2)
  })

  it('caps the mutations produced for one file', () => {
    const source = 'const a = true\nconst b = true\nconst c = true\nconst d = true\nconst e = true\n'

    expect(mutationsOfSource('a.ts', source, 3)).toHaveLength(3)
  })

  it('produces nothing for a source with no mutable construct', () => {
    expect(mutationsOfSource('a.ts', 'const total = a + b\n')).toEqual([])
  })
})
