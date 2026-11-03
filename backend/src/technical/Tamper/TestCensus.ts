export type TestCensus = {
  tests: number
  skipped: number
  tautologies: number
}

const TEST_DECLARATION = /(?<![\w$.])(?:it|test)(?:\.(?:skip|todo|failing|concurrent|only|each))?\s*[(`]/g
const SKIPPED_DECLARATION = /(?<![\w$.])(?:(?:it|test|describe)\.(?:skip|todo)|xit|xtest|xdescribe)\s*[(`]/g
const ASSERTION = /expect\(\s*([^()]*?)\s*\)\s*\.\s*(?:toBe|toEqual|toStrictEqual)\(\s*([^()]*?)\s*\)/g

function countMatches(source: string, pattern: RegExp): number {
  return source.match(new RegExp(pattern.source, 'g'))?.length ?? 0
}

function countTautologies(source: string): number {
  let total = 0
  for (const match of source.matchAll(new RegExp(ASSERTION.source, 'g'))) {
    const [, received = '', expected = ''] = match
    if (received.trim() === expected.trim()) {
      total += 1
    }
  }
  return total
}

export function censusOfSource(source: string): TestCensus {
  return {
    tests: countMatches(source, TEST_DECLARATION),
    skipped: countMatches(source, SKIPPED_DECLARATION),
    tautologies: countTautologies(source),
  }
}

export function addCensus(left: TestCensus, right: TestCensus): TestCensus {
  return {
    tests: left.tests + right.tests,
    skipped: left.skipped + right.skipped,
    tautologies: left.tautologies + right.tautologies,
  }
}

export const EMPTY_CENSUS: TestCensus = { tests: 0, skipped: 0, tautologies: 0 }

export function compareCensus(before: TestCensus, after: TestCensus): readonly string[] {
  const findings: string[] = []
  if (after.tests < before.tests) {
    findings.push(`${before.tests - after.tests} tests ont disparu depuis l'ecriture des tests`)
  }
  if (after.skipped > before.skipped) {
    findings.push(`${after.skipped - before.skipped} tests ont ete mis de cote depuis l'ecriture des tests`)
  }
  if (after.tautologies > before.tautologies) {
    findings.push(
      `${after.tautologies - before.tautologies} assertions ne prouvent plus rien depuis l'ecriture des tests`,
    )
  }
  return findings
}
