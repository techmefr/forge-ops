import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSettings } from '@anthropic-ai/claude-agent-sdk'
import type { SettingSource } from '@anthropic-ai/claude-agent-sdk'

export const forgeSettingSources: readonly SettingSource[] = ['user', 'project', 'local']

export const guardrailHookFiles = ['Guardrail/DenyHook.ts', 'Guardrail/ScopeHook.ts'] as const

export const DENY_MATCHER = 'Bash|PowerShell'

export const SCOPE_MATCHER = 'Write|Edit|MultiEdit|NotebookEdit'

const HOOK_TIMEOUT_SECONDS = 10

const ESCALATING_MODES = new Set(['bypassPermissions', 'acceptEdits', 'dontAsk', 'auto'])

const PLACEHOLDER = '${CLAUDE_PROJECT_DIR}'

export class GuardrailNotRegisteredError extends Error {
  constructor(reason: string) {
    super(`aucune session ne peut demarrer sans garde-fou : ${reason}`)
    this.name = 'GuardrailNotRegisteredError'
  }
}

export type ExpectedHook = {
  file: (typeof guardrailHookFiles)[number]
  matcher: string
  command: string
  args: string[]
}

type Json = Record<string, unknown>

function recordOf(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null
}

export function expectedGuardrailHooks(forgeRoot: string): ExpectedHook[] {
  const command = join(forgeRoot, 'node_modules', '.bin', 'tsx')
  const entrypoint = (file: string): string => join(forgeRoot, 'backend', 'src', 'technical', file)
  return [
    { file: 'Guardrail/DenyHook.ts', matcher: DENY_MATCHER, command, args: [entrypoint('Guardrail/DenyHook.ts')] },
    { file: 'Guardrail/ScopeHook.ts', matcher: SCOPE_MATCHER, command, args: [entrypoint('Guardrail/ScopeHook.ts')] },
  ]
}

export function guardrailHookEntry(hook: ExpectedHook): Json {
  return {
    matcher: hook.matcher,
    hooks: [{ type: 'command', command: hook.command, args: hook.args, timeout: HOOK_TIMEOUT_SECONDS }],
  }
}

export function guardrailHookSettings(forgeRoot: string): Json {
  return { hooks: { PreToolUse: expectedGuardrailHooks(forgeRoot).map(guardrailHookEntry) } }
}

function preToolUseEntriesOf(settings: Json): Json[] {
  const beforeTool = recordOf(settings.hooks)?.PreToolUse
  if (!Array.isArray(beforeTool)) {
    return []
  }
  return beforeTool.flatMap((entry) => {
    const record = recordOf(entry)
    return record === null ? [] : [record]
  })
}

function isExactCommandHook(hook: unknown, expected: ExpectedHook, expand: (value: string) => string): boolean {
  const record = recordOf(hook)
  if (record === null || record.type !== 'command' || typeof record.command !== 'string') {
    return false
  }
  const extraKey = Object.keys(record).find((key) => !['type', 'command', 'args', 'timeout'].includes(key))
  if (extraKey !== undefined) {
    return false
  }
  if (record.timeout !== undefined && typeof record.timeout !== 'number') {
    return false
  }
  const args = record.args
  return (
    expand(record.command) === expected.command &&
    Array.isArray(args) &&
    args.length === expected.args.length &&
    args.every((arg, position) => typeof arg === 'string' && expand(arg) === expected.args[position])
  )
}

function declaresExactly(entry: Json, expected: ExpectedHook, expand: (value: string) => string): boolean {
  return (
    entry.matcher === expected.matcher &&
    Array.isArray(entry.hooks) &&
    entry.hooks.length === 1 &&
    isExactCommandHook(entry.hooks[0], expected, expand)
  )
}

const KEEP = (value: string): string => value

export function guardrailHooksMissingFrom(settings: Json, forgeRoot: string): string[] {
  const entries = preToolUseEntriesOf(settings)
  return expectedGuardrailHooks(forgeRoot)
    .filter((expected) => !entries.some((entry) => declaresExactly(entry, expected, KEEP)))
    .map((expected) => expected.file)
}

function isOurs(entry: Json, forgeRoot: string, cwd: string): boolean {
  const expand = (value: string): string => value.split(PLACEHOLDER).join(cwd)
  return [...expectedGuardrailHooks(forgeRoot), ...expectedGuardrailHooks(cwd)].some(
    (expected) => declaresExactly(entry, expected, KEEP) || declaresExactly(entry, expected, expand),
  )
}

export type SettingsLayer = { source: string; settings: Json }

export function settingsFindingsOf(layers: readonly SettingsLayer[], effective: Json, forgeRoot: string, cwd: string): string[] {
  const findings: string[] = []
  if (effective.disableAllHooks === true) {
    findings.push('disableAllHooks is true, so no guardrail hook would run')
  }
  for (const { source, settings } of layers) {
    const permissions = recordOf(settings.permissions)
    if (Array.isArray(permissions?.allow) && permissions.allow.length > 0) {
      findings.push(`${source} settings carry permissions.allow rules that skip the permission layer`)
    }
    if (typeof permissions?.defaultMode === 'string' && ESCALATING_MODES.has(permissions.defaultMode)) {
      findings.push(`${source} settings set permissions.defaultMode to ${permissions.defaultMode}`)
    }
    if (settings.enableAllProjectMcpServers === true) {
      findings.push(`${source} settings enable every project MCP server`)
    }
    if (settings.disableAllHooks === true) {
      findings.push(`${source} settings disable all hooks`)
    }
    const foreign = preToolUseEntriesOf(settings).filter((entry) => !isOurs(entry, forgeRoot, cwd))
    if (foreign.length > 0) {
      findings.push(`${source} settings declare a PreToolUse hook that is not the forge guardrail`)
    }
    const hooks = recordOf(settings.hooks)
    if (Array.isArray(hooks?.PermissionRequest) && hooks.PermissionRequest.length > 0) {
      findings.push(`${source} settings declare PermissionRequest hooks that can approve tools on their own`)
    }
  }
  return findings
}

function missingGuardrailFiles(forgeRoot: string): string[] {
  const needed = expectedGuardrailHooks(forgeRoot).flatMap((hook) => [hook.command, ...hook.args])
  return needed.filter((path) => !existsSync(path) || !statSync(path).isFile())
}

export async function assertGuardrailRegistered(cwd: string, forgeRoot: string = process.cwd()): Promise<void> {
  const absent = missingGuardrailFiles(forgeRoot)
  if (absent.length > 0) {
    throw new GuardrailNotRegisteredError(`fichiers du garde-fou introuvables : ${absent.join(', ')} (npm ci dans ${forgeRoot})`)
  }
  let effective: Json
  let layers: SettingsLayer[]
  try {
    const resolved = await resolveSettings({ cwd, settingSources: [...forgeSettingSources] })
    effective = resolved.effective as Json
    const sources = Array.isArray(resolved.sources) ? resolved.sources : null
    layers =
      sources === null
        ? [{ source: 'effective', settings: effective }]
        : sources
            .filter((layer) => layer.source === 'project' || layer.source === 'local')
            .map((layer) => ({ source: layer.source, settings: layer.settings as Json }))
  } catch (error) {
    throw new GuardrailNotRegisteredError(
      `les reglages n'ont pas pu etre lus (${error instanceof Error ? error.message : String(error)})`,
    )
  }
  const findings = settingsFindingsOf(layers, effective, forgeRoot, cwd)
  if (findings.length > 0) {
    throw new GuardrailNotRegisteredError(findings.join(' ; '))
  }
  const loaded = { hooks: { PreToolUse: [...preToolUseEntriesOf(effective), ...preToolUseEntriesOf(guardrailHookSettings(forgeRoot))] } }
  const missing = guardrailHooksMissingFrom(loaded, forgeRoot)
  if (missing.length > 0) {
    throw new GuardrailNotRegisteredError(`hooks absents des reglages charges : ${missing.join(', ')}`)
  }
}
