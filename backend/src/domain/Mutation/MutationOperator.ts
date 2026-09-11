import { MUTATION_OPERATORS, MUTATION_PER_FILE_CAP, type Mutation, type MutationOperator } from './Mutation.js'

type Candidate = {
  start: number
  length: number
  replacement: string
}

const BOOLEAN_LITERAL = /\b(?:true|false)\b/g
const STRICT_COMPARISON = /===|!==/g
const DROPPED_NEGATION = /!(?=[A-Za-z_$([])/g
const RETURNED_EXPRESSION = /\breturn\s+(?!undefined\b)[^;\r\n]+/g

function flippedBoolean(found: string): string {
  return found === 'true' ? 'false' : 'true'
}

function invertedComparison(found: string): string {
  return found === '===' ? '!==' : '==='
}

function candidatesOf(line: string, operator: MutationOperator): readonly Candidate[] {
  const candidates: Candidate[] = []
  if (operator === 'boolean_literal') {
    for (const match of line.matchAll(BOOLEAN_LITERAL)) {
      candidates.push({ start: match.index, length: match[0].length, replacement: flippedBoolean(match[0]) })
    }
    return candidates
  }
  if (operator === 'strict_comparison') {
    for (const match of line.matchAll(STRICT_COMPARISON)) {
      candidates.push({ start: match.index, length: match[0].length, replacement: invertedComparison(match[0]) })
    }
    return candidates
  }
  if (operator === 'dropped_negation') {
    for (const match of line.matchAll(DROPPED_NEGATION)) {
      candidates.push({ start: match.index, length: 1, replacement: '' })
    }
    return candidates
  }
  for (const match of line.matchAll(RETURNED_EXPRESSION)) {
    candidates.push({ start: match.index, length: match[0].length, replacement: 'return undefined' })
  }
  return candidates
}

export function mutationsOfSource(
  path: string,
  source: string,
  cap: number = MUTATION_PER_FILE_CAP,
): readonly Mutation[] {
  const lines = source.split('\n')
  const mutations: Mutation[] = []
  for (const [index, line] of lines.entries()) {
    for (const operator of MUTATION_OPERATORS) {
      for (const candidate of candidatesOf(line, operator)) {
        if (mutations.length >= cap) {
          return mutations
        }
        const mutated = [...lines]
        mutated[index] =
          line.slice(0, candidate.start) + candidate.replacement + line.slice(candidate.start + candidate.length)
        mutations.push({
          path,
          operator,
          line: index + 1,
          source: mutated.join('\n'),
        })
      }
    }
  }
  return mutations
}
