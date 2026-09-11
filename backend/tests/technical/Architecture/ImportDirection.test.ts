import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { edgeKey, reportOfRoot } from '../../../src/technical/Architecture/ImportDirection.js'
import { BASELINE_PATH, LAYER_ROOTS } from '../../../src/technical/Architecture/ImportRoot.js'

const readBaseline = (): string[] => JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as string[]

const currentViolations = (): string[] =>
  LAYER_ROOTS.flatMap((root) => reportOfRoot(root).violations.map(edgeKey)).sort()

describe('import direction', () => {
  it('reads every source file of both layer roots', () => {
    for (const root of LAYER_ROOTS) {
      expect(reportOfRoot(root).edges.length).toBeGreaterThan(0)
    }
  })

  it('records a baseline that only holds known violations', () => {
    const baseline = readBaseline()
    expect(baseline).toStrictEqual([...baseline].sort())
    expect(new Set(baseline).size).toBe(baseline.length)
  })

  it('reports no technical to domain import outside the recorded baseline', () => {
    const baseline = new Set(readBaseline())
    const introduced = currentViolations().filter((violation) => !baseline.has(violation))
    expect(introduced, `new technical -> domain imports:\n${introduced.join('\n')}`).toStrictEqual([])
  })

  it('never lets the violation count rise above the recorded baseline', () => {
    expect(currentViolations().length).toBeLessThanOrEqual(readBaseline().length)
  })
})
