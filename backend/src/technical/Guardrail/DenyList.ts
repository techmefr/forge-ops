import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { UnreadableDenyListError } from './GuardrailViolation.js'

const denyFileSchema = z.object({
  deny: z.array(z.string().min(1)),
})

const SEGMENT_SEPARATORS = /&&|\|\||;|&|\||\n|\$\(|\$\{|`|\(|\)|\}/
const QUOTED_RUNS = /"([^"]*)"|'([^']*)'/g
const LEADING_ASSIGNMENT = /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=/
const HEAD_TOKEN_LIMIT = 2

function escapeExceptWildcard(pattern: string): string {
  return pattern.replace(/[.+?^${}()|[\]\\]/g, (match) => `\\${match}`)
}

function toRegExp(pattern: string): RegExp {
  return new RegExp(`^${escapeExceptWildcard(pattern).replace(/\*/g, '.*')}$`, 's')
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function unquote(value: string): string {
  const trimmed = value.trim()
  const isQuoted =
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))

  return isQuoted ? trimmed.slice(1, -1) : trimmed
}

function quotedRunsOf(command: string): readonly string[] {
  return [...command.matchAll(QUOTED_RUNS)].map((match) => match[1] ?? match[2] ?? '')
}

function assignedValueOf(segment: string): string | null {
  if (!LEADING_ASSIGNMENT.test(segment)) {
    return null
  }

  return collapseWhitespace(unquote(segment.slice(segment.indexOf('=') + 1)))
}

function flagVariantsOf(candidate: string): readonly string[] {
  const tokens = candidate.split(' ').filter((token) => token.length > 0)
  if (tokens.length < 3) {
    return []
  }

  const headLength = tokens[1]?.startsWith('-') === true ? 1 : HEAD_TOKEN_LIMIT
  const head = tokens.slice(0, headLength)
  const tail = tokens.slice(headLength)

  return tail.flatMap((token, index) =>
    index === 0 || !token.startsWith('-')
      ? []
      : [[...head, token, ...tail.filter((_, other) => other !== index)].join(' ')],
  )
}

function candidatesOf(command: string): readonly string[] {
  const whole = collapseWhitespace(command)
  const segments = [whole, ...command.split(SEGMENT_SEPARATORS), ...quotedRunsOf(command)]
    .map(collapseWhitespace)
    .filter((segment) => segment.length > 0)

  const assigned = segments
    .map(assignedValueOf)
    .filter((value): value is string => value !== null && value.length > 0)

  const normalised = [...segments, ...assigned]

  return [...new Set([...normalised, ...normalised.flatMap(flagVariantsOf)])]
}

export function loadDenyPatterns(path: string): readonly string[] {
  let raw: string
  try {
    raw = readFileSync(path, 'utf-8')
  } catch (error) {
    throw new UnreadableDenyListError(path, error instanceof Error ? error.message : 'lecture impossible')
  }

  let content: unknown
  try {
    content = JSON.parse(raw)
  } catch (error) {
    throw new UnreadableDenyListError(path, error instanceof Error ? error.message : 'JSON invalide')
  }

  const parsed = denyFileSchema.safeParse(content)
  if (!parsed.success) {
    throw new UnreadableDenyListError(path, 'la cle deny doit etre une liste de chaines non vides')
  }

  return parsed.data.deny
}

export function matchDeniedPattern(command: string, patterns: readonly string[]): string | null {
  const candidates = candidatesOf(command)

  return patterns.find((pattern) => candidates.some((candidate) => toRegExp(pattern).test(candidate))) ?? null
}
