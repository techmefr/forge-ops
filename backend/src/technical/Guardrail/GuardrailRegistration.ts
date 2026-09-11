import { resolveSettings } from '@anthropic-ai/claude-agent-sdk'
import type { SettingSource } from '@anthropic-ai/claude-agent-sdk'

export const forgeSettingSources: readonly SettingSource[] = ['user', 'project', 'local']

export const guardrailHookFiles = ['Guardrail/DenyHook.ts', 'Guardrail/ScopeHook.ts'] as const

export class GuardrailNotRegisteredError extends Error {
  constructor(reason: string) {
    super(`aucune session ne peut demarrer sans garde-fou : ${reason}`)
    this.name = 'GuardrailNotRegisteredError'
  }
}

function commandsDeclaredBy(settings: Record<string, unknown>): string[] {
  const hooks = settings.hooks
  if (typeof hooks !== 'object' || hooks === null) {
    return []
  }
  const beforeTool = (hooks as Record<string, unknown>).PreToolUse
  if (!Array.isArray(beforeTool)) {
    return []
  }
  return beforeTool.flatMap((entry) => {
    const declared = (entry as Record<string, unknown> | null)?.hooks
    if (!Array.isArray(declared)) {
      return []
    }
    return declared
      .filter((hook) => (hook as Record<string, unknown> | null)?.type === 'command')
      .map((hook) => {
        const record = hook as Record<string, unknown>
        const args = Array.isArray(record.args) ? record.args : []
        return [record.command, ...args].filter((piece) => typeof piece === 'string').join(' ')
      })
  })
}

export function guardrailHooksMissingFrom(settings: Record<string, unknown>): string[] {
  const declared = commandsDeclaredBy(settings)
  return guardrailHookFiles.filter((file) => !declared.some((command) => command.includes(file)))
}

export async function assertGuardrailRegistered(cwd: string): Promise<void> {
  let effective: Record<string, unknown>
  try {
    const resolved = await resolveSettings({ cwd, settingSources: [...forgeSettingSources] })
    effective = resolved.effective as Record<string, unknown>
  } catch (error) {
    throw new GuardrailNotRegisteredError(
      `les reglages n'ont pas pu etre lus (${error instanceof Error ? error.message : String(error)})`,
    )
  }
  const missing = guardrailHooksMissingFrom(effective)
  if (missing.length > 0) {
    throw new GuardrailNotRegisteredError(`hooks absents des reglages charges : ${missing.join(', ')}`)
  }
}
