import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const LOCAL_SETTINGS_FILE = join('.claude', 'settings.local.json')

export const LOCALLY_EXCLUDED = ['.claude/settings.local.json', '.claude/evidence/'] as const

const SETTINGS_MODE = 0o600

export type CarryResult = 'copied' | 'current' | 'absent'

function excludeFileOf(checkout: string): string | null {
  try {
    const found = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], {
      cwd: checkout,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return found === '' ? null : resolve(checkout, found)
  } catch {
    return null
  }
}

export function excludeLocalFiles(checkout: string): string | null {
  const file = excludeFileOf(checkout)
  if (file === null) {
    return null
  }
  const current = existsSync(file) ? readFileSync(file, 'utf-8') : ''
  const present = new Set(current.split(/\r?\n/).map((line) => line.trim()))
  const missing = LOCALLY_EXCLUDED.filter((pattern) => !present.has(pattern))
  if (missing.length === 0) {
    return file
  }
  const separator = current === '' || current.endsWith('\n') ? '' : '\n'
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${current}${separator}${missing.join('\n')}\n`, 'utf-8')
  return file
}

export function carryLocalSettings(checkout: string, worktree: string): CarryResult {
  const source = join(checkout, LOCAL_SETTINGS_FILE)
  if (!existsSync(source)) {
    return 'absent'
  }
  excludeLocalFiles(checkout)
  const content = readFileSync(source, 'utf-8')
  const target = join(worktree, LOCAL_SETTINGS_FILE)
  if (existsSync(target) && readFileSync(target, 'utf-8') === content) {
    return 'current'
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, { encoding: 'utf-8', mode: SETTINGS_MODE })
  chmodSync(target, SETTINGS_MODE)
  return 'copied'
}
