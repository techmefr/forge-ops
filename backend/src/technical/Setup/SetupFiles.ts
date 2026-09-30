import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SECRET_BYTES = 24
const PRIVATE_FILE_MODE = 0o600

export function newSecret(): string {
  return randomBytes(SECRET_BYTES).toString('base64url')
}

export function secretPath(directory: string, name: string): string {
  return join(directory, `${name}.secret`)
}

export function writeSecretOnce(directory: string, name: string, value: string): boolean {
  const path = secretPath(directory, name)
  if (existsSync(path)) {
    return false
  }
  mkdirSync(directory, { recursive: true })
  writeFileSync(path, value, { mode: PRIVATE_FILE_MODE })
  return true
}

export function writeEnvFile(directory: string, lines: readonly string[]): string {
  const path = join(directory, '.env')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path, `${lines.join('\n')}\n`, { mode: PRIVATE_FILE_MODE })
  return path
}
