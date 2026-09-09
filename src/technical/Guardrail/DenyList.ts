import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { UnreadableDenyListError } from './GuardrailViolation.js'

const denyFileSchema = z.object({
  deny: z.array(z.string().min(1)),
})

const SEGMENT_SEPARATORS = /&&|\|\||;|\||\n/

function escapeExceptWildcard(pattern: string): string {
  return pattern.replace(/[.+?^${}()|[\]\\]/g, (match) => `\\${match}`)
}

function toRegExp(pattern: string): RegExp {
  return new RegExp(`^${escapeExceptWildcard(pattern).replace(/\*/g, '.*')}$`, 's')
}

function candidatesOf(command: string): readonly string[] {
  const whole = command.trim()
  const segments = whole
    .split(SEGMENT_SEPARATORS)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  return [whole, ...segments]
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
