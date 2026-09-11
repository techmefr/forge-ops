import { MUTATION_FILE_CAP, type MutationOutcome } from './Mutation.js'

const MUTABLE_SOURCE = /\.[cm]?ts$/
const TEST_SOURCE = /\.(?:test|spec)\.[cm]?ts$/

export function filesWorthMutating(paths: readonly string[], cap: number = MUTATION_FILE_CAP): readonly string[] {
  const kept: string[] = []
  for (const path of paths) {
    if (kept.length >= cap) {
      return kept
    }
    if (!MUTABLE_SOURCE.test(path) || TEST_SOURCE.test(path) || kept.includes(path)) {
      continue
    }
    kept.push(path)
  }
  return kept
}

export function survivorsOf(outcomes: readonly MutationOutcome[]): readonly MutationOutcome[] {
  return outcomes.filter((outcome) => !outcome.killed)
}

export function describeSurvivor(survivor: MutationOutcome): string {
  return `${survivor.path}:${survivor.line} ${survivor.operator}`
}
