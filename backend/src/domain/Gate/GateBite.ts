export type BiteCase = {
  readonly name: string
  readonly rejects: string
  readonly exitCode: number
}

export type BiteVerdict = {
  readonly bites: boolean
  readonly accepted: readonly string[]
  readonly exercised: readonly string[]
}

export function verdictOfBites(cases: readonly BiteCase[]): BiteVerdict {
  const accepted = cases.filter((one) => one.exitCode === 0).map((one) => one.name)
  return {
    bites: cases.length > 0 && accepted.length === 0,
    accepted,
    exercised: cases.map((one) => one.name),
  }
}

export function reportBites(verdict: BiteVerdict): string {
  if (verdict.exercised.length === 0) {
    return 'Gate proof empty: no known-bad input was exercised, so nothing is proven.'
  }
  if (verdict.accepted.length > 0) {
    return `Gate does not bite: ${verdict.accepted.join(', ')} accepted a known-bad input.`
  }
  return `Gate bites: ${verdict.exercised.join(', ')} each rejected a known-bad input.`
}
