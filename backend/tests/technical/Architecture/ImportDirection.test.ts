import { describe, expect, it } from 'vitest'

import {
  LAYER_ROOTS,
  edgeKey,
  isViolation,
  readBaseline,
  scanRoot,
} from '../../../../scripts/importDirection.js'

const currentViolations = (): string[] =>
  LAYER_ROOTS.flatMap((root) => scanRoot(root).filter(isViolation).map(edgeKey)).sort()

describe('import direction', () => {
  it('reads every source file of both layer roots', () => {
    for (const root of LAYER_ROOTS) {
      expect(scanRoot(root).length).toBeGreaterThan(0)
    }
  })

  it('holds a sorted baseline without duplicates', () => {
    const baseline = readBaseline()
    expect(baseline).toStrictEqual([...baseline].sort())
    expect(new Set(baseline).size).toBe(baseline.length)
  })

  it('reports no technical to domain import outside the recorded baseline', () => {
    const baseline = new Set(readBaseline())
    const introduced = currentViolations().filter((violation) => !baseline.has(violation))
    expect(introduced, `new technical -> domain imports:\n${introduced.join('\n')}`).toStrictEqual([])
  })

  it('holds no baseline entry the code no longer contains', () => {
    const live = new Set(currentViolations())
    const stale = readBaseline().filter((entry) => !live.has(entry))
    expect(stale, `baseline entries that no longer exist:\n${stale.join('\n')}`).toStrictEqual([])
  })
})
