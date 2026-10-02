import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { buildHookSettings } from '../Auth/HookSettings.js'
import { guardrailHookFiles } from './GuardrailRegistration.js'
import { excludeLocalFiles } from './LocalSettings.js'

export class GuardrailInstallRefusedError extends Error {
  constructor(reason: string) {
    super(`guardrails not installed: ${reason}`)
    this.name = 'GuardrailInstallRefusedError'
  }
}

export type GuardrailInstallInput = {
  checkout: string
  forgeRoot: string
  hook?: { port: number; token: string }
}

export type GuardrailInstallResult = {
  settingsPath: string
  localSettingsPath: string | null
  excludeFile: string | null
}

type Settings = Record<string, unknown>
type HookEntry = Record<string, unknown>

const DENY_MATCHER = 'Bash|PowerShell'
const SCOPE_MATCHER = 'Write|Edit|MultiEdit|NotebookEdit'
const OWNED_MARKERS = [...guardrailHookFiles, '/api/hooks']
const SETTINGS_MODE = 0o600

function readSettings(path: string): Settings {
  if (!existsSync(path)) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('not a JSON object')
    }
    return parsed as Settings
  } catch (error) {
    throw new GuardrailInstallRefusedError(
      `${path} is not readable JSON (${error instanceof Error ? error.message : String(error)})`,
    )
  }
}

function isOwned(entry: HookEntry): boolean {
  const serialized = JSON.stringify(entry)
  return OWNED_MARKERS.some((marker) => serialized.includes(marker))
}

function withHooks(settings: Settings, event: string, entries: readonly HookEntry[]): Settings {
  const hooks = typeof settings.hooks === 'object' && settings.hooks !== null ? (settings.hooks as Settings) : {}
  const current = Array.isArray(hooks[event]) ? (hooks[event] as HookEntry[]) : []
  return { ...settings, hooks: { ...hooks, [event]: [...current.filter((entry) => !isOwned(entry)), ...entries] } }
}

function commandHook(forgeRoot: string, file: string): HookEntry {
  return {
    type: 'command',
    command: join(forgeRoot, 'node_modules', '.bin', 'tsx'),
    args: [join(forgeRoot, 'backend', 'src', 'technical', 'Guardrail', file)],
    timeout: 10,
  }
}

function write(path: string, settings: Settings): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf-8', mode: SETTINGS_MODE })
}

export function installGuardrails({ checkout, forgeRoot, hook }: GuardrailInstallInput): GuardrailInstallResult {
  const root = resolve(checkout)
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new GuardrailInstallRefusedError(`${root} is not a directory`)
  }
  const tsx = join(forgeRoot, 'node_modules', '.bin', 'tsx')
  if (!existsSync(tsx)) {
    throw new GuardrailInstallRefusedError(`${tsx} is missing, run npm ci in ${forgeRoot}`)
  }
  const settingsPath = join(root, '.claude', 'settings.json')
  const shared = withHooks(readSettings(settingsPath), 'PreToolUse', [
    { matcher: DENY_MATCHER, hooks: [commandHook(forgeRoot, 'DenyHook.ts')] },
    { matcher: SCOPE_MATCHER, hooks: [commandHook(forgeRoot, 'ScopeHook.ts')] },
  ])
  write(settingsPath, shared)
  const excludeFile = excludeLocalFiles(root)
  if (hook === undefined) {
    return { settingsPath, localSettingsPath: null, excludeFile }
  }
  const localSettingsPath = join(root, '.claude', 'settings.local.json')
  const postHooks = (buildHookSettings(hook).hooks as Settings).PostToolUse as HookEntry[]
  write(localSettingsPath, withHooks(readSettings(localSettingsPath), 'PostToolUse', postHooks))
  return { settingsPath, localSettingsPath, excludeFile }
}
