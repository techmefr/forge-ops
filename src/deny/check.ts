import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DENY_PATH = join(MODULE_DIR, '..', '..', '.claude-deny.json')

interface IDenyConfig {
  deny: string[]
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, (match) => (match === '*' ? match : `\\${match}`))
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = escapeRegExp(pattern).replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 's')
}

export function loadDenyPatterns(denyPath: string = DEFAULT_DENY_PATH): string[] {
  const raw = readFileSync(denyPath, 'utf-8')
  const config = JSON.parse(raw) as IDenyConfig
  return config.deny
}

export interface IDenyCheckResult {
  isDenied: boolean
  matchedPattern: string | null
}

export function checkCommand(command: string, patterns: string[]): IDenyCheckResult {
  const trimmedCommand = command.trim()
  const matched = patterns.find((pattern) => patternToRegExp(pattern).test(trimmedCommand))
  return {
    isDenied: matched !== undefined,
    matchedPattern: matched ?? null,
  }
}
