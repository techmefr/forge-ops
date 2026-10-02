import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { realPathOf } from './ProtectedPaths.js'

const WATCHED_FILES = [
  join('.claude', 'settings.json'),
  join('.claude', 'settings.local.json'),
  '.claude-deny.json',
  '.mcp.json',
] as const

const WATCHED_FOLDERS = [join('.claude', 'hooks')] as const

const GUARDRAIL_FOLDER = join('backend', 'src', 'technical', 'Guardrail')

export type Fingerprint = Readonly<Record<string, string>>

export class GuardrailTamperedError extends Error {
  constructor(public readonly changes: readonly string[]) {
    super(`guardrail files changed while the agent was running: ${changes.join(', ')}`)
    this.name = 'GuardrailTamperedError'
  }
}

function hashOf(path: string): string {
  try {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) {
      return `link:${readlinkSync(path)}`
    }
    if (!stat.isFile()) {
      return 'not-a-file'
    }
    return createHash('sha256').update(readFileSync(path)).digest('hex')
  } catch {
    return 'absent'
  }
}

const MAX_DEPTH = 6

function filesUnder(folder: string, depth = 0): string[] {
  if (depth > MAX_DEPTH || !existsSync(folder)) {
    return []
  }
  try {
    return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
      const path = join(folder, entry.name)
      return entry.isDirectory() ? filesUnder(path, depth + 1) : [path]
    })
  } catch {
    return []
  }
}

function gitPathOf(cwd: string, name: string): string | null {
  try {
    const found = execFileSync('git', ['rev-parse', '--git-path', name], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return found === '' ? null : resolve(cwd, found)
  } catch {
    return null
  }
}

export function fingerprintOf(cwd: string, forgeRoot: string): Fingerprint {
  const root = realPathOf(cwd)
  const recorded: Record<string, string> = {}
  for (const file of WATCHED_FILES) {
    recorded[join(root, file)] = hashOf(join(root, file))
  }
  const folders = [
    ...WATCHED_FOLDERS.map((folder) => join(root, folder)),
    join(realPathOf(forgeRoot), GUARDRAIL_FOLDER),
    join(root, GUARDRAIL_FOLDER),
  ]
  const config = gitPathOf(root, 'config')
  const hooks = config === null ? null : join(dirname(config), 'hooks')
  if (config !== null) {
    recorded[config] = hashOf(config)
  }
  if (hooks !== null) {
    folders.push(hooks)
  }
  for (const folder of folders) {
    for (const file of filesUnder(folder)) {
      recorded[file] = hashOf(file)
    }
  }
  return recorded
}

export function changesBetween(before: Fingerprint, after: Fingerprint): string[] {
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...names].filter((name) => (before[name] ?? 'absent') !== (after[name] ?? 'absent')).sort()
}

export type GuardrailSeal = {
  seal: (cwd: string) => void
  changesSince: (cwd: string) => string[]
  tamperedReason: (cwd: string) => string | null
  markTampered: (cwd: string, changes: readonly string[]) => void
  forget: (cwd: string) => void
}

export function createGuardrailSeal(forgeRoot: string): GuardrailSeal {
  const sealed = new Map<string, Fingerprint>()
  const tampered = new Map<string, string>()
  const keyOf = (cwd: string): string => realPathOf(cwd)

  return {
    seal: (cwd) => {
      sealed.set(keyOf(cwd), fingerprintOf(cwd, forgeRoot))
    },
    changesSince: (cwd) => {
      const before = sealed.get(keyOf(cwd))
      return before === undefined ? [] : changesBetween(before, fingerprintOf(cwd, forgeRoot))
    },
    tamperedReason: (cwd) => tampered.get(keyOf(cwd)) ?? null,
    markTampered: (cwd, changes) => {
      tampered.set(keyOf(cwd), new GuardrailTamperedError(changes).message)
    },
    forget: (cwd) => {
      sealed.delete(keyOf(cwd))
      tampered.delete(keyOf(cwd))
    },
  }
}
