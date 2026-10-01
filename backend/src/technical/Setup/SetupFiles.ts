import { randomBytes } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SECRET_BYTES = 24
const PRIVATE_FILE_MODE = 0o600
const ENV_KEY = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/

export function newSecret(): string {
  return randomBytes(SECRET_BYTES).toString('base64url')
}

export function secretPath(directory: string, name: string): string {
  return join(directory, `${name}.secret`)
}

export function writeSecretOnce(directory: string, name: string, value: string): boolean {
  const path = secretPath(directory, name)
  if (existsSync(path) && statSync(path).size > 0) {
    return false
  }
  mkdirSync(directory, { recursive: true })
  writeFileSync(path, value, { mode: PRIVATE_FILE_MODE })
  chmodSync(path, PRIVATE_FILE_MODE)
  return true
}

function keyOf(line: string): string | null {
  return ENV_KEY.exec(line)?.[1] ?? null
}

function mergedLines(existing: readonly string[], lines: readonly string[]): readonly string[] {
  const replacements = new Map(lines.map((line) => [keyOf(line), line] as const))
  const written = new Set<string>()
  const kept = existing.map((line) => {
    const key = keyOf(line)
    const replacement = key === null ? undefined : replacements.get(key)
    if (key === null || replacement === undefined) {
      return line
    }
    written.add(key)
    return replacement
  })
  return [...kept, ...lines.filter((line) => !written.has(keyOf(line) ?? ''))]
}

export function writeEnvFile(directory: string, lines: readonly string[]): string {
  const path = join(directory, '.env')
  mkdirSync(directory, { recursive: true })
  let merged = lines
  if (existsSync(path)) {
    const backup = `${path}.bak`
    copyFileSync(path, backup)
    chmodSync(backup, PRIVATE_FILE_MODE)
    merged = mergedLines(readFileSync(path, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/), lines)
  }
  writeFileSync(path, `${merged.join('\n')}\n`, { mode: PRIVATE_FILE_MODE })
  chmodSync(path, PRIVATE_FILE_MODE)
  return path
}
