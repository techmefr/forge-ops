import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const resolved = vi.fn()

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  resolveSettings: (input: unknown) => resolved(input),
}))

const {
  assertGuardrailRegistered,
  expectedGuardrailHooks,
  forgeSettingSources,
  guardrailHookFiles,
  guardrailHookSettings,
  guardrailHooksMissingFrom,
  settingsFindingsOf,
  GuardrailNotRegisteredError,
} = await import('../../../src/technical/Guardrail/GuardrailRegistration.js')

const FORGE_ROOT = join(import.meta.dirname, '..', '..', '..', '..')

function neutered(command: string, args: string[], matcher = 'Bash|PowerShell'): Record<string, unknown> {
  return { hooks: { PreToolUse: [{ matcher, hooks: [{ type: 'command', command, args }] }] } }
}

describe('guardrailHooksMissingFrom', () => {
  it('reports nothing missing for the exact hooks the forge injects', () => {
    expect(guardrailHooksMissingFrom(guardrailHookSettings(FORGE_ROOT), FORGE_ROOT)).toEqual([])
  })

  it('names both hooks when the settings carry none', () => {
    expect(guardrailHooksMissingFrom({}, FORGE_ROOT)).toEqual([...guardrailHookFiles])
  })

  it('refuses the echo wrapper that only mentions the hook file', () => {
    const settings = neutered('echo', ['Guardrail/DenyHook.ts', 'Guardrail/ScopeHook.ts'])

    expect(guardrailHooksMissingFrom(settings, FORGE_ROOT)).toEqual([...guardrailHookFiles])
  })

  it('refuses a hook file path that is not the real entrypoint of this install', () => {
    const [deny] = expectedGuardrailHooks(FORGE_ROOT)
    const settings = neutered(deny!.command, ['/tmp/evil/Guardrail/DenyHook.ts'])

    expect(guardrailHooksMissingFrom(settings, FORGE_ROOT)).toContain('Guardrail/DenyHook.ts')
  })

  it('refuses a shell wrapper around the real entrypoint', () => {
    const [deny] = expectedGuardrailHooks(FORGE_ROOT)
    const settings = neutered('sh', ['-c', `${deny!.command} ${deny!.args[0]} || true`])

    expect(guardrailHooksMissingFrom(settings, FORGE_ROOT)).toContain('Guardrail/DenyHook.ts')
  })

  it('refuses extra arguments after the entrypoint', () => {
    const [deny] = expectedGuardrailHooks(FORGE_ROOT)
    const settings = neutered(deny!.command, [...deny!.args, '--allow-all'])

    expect(guardrailHooksMissingFrom(settings, FORGE_ROOT)).toContain('Guardrail/DenyHook.ts')
  })

  it('refuses the right command under a widened or narrowed matcher', () => {
    const [deny] = expectedGuardrailHooks(FORGE_ROOT)

    expect(guardrailHooksMissingFrom(neutered(deny!.command, deny!.args, 'Read'), FORGE_ROOT)).toContain(
      'Guardrail/DenyHook.ts',
    )
    expect(guardrailHooksMissingFrom(neutered(deny!.command, deny!.args, 'Bash'), FORGE_ROOT)).toContain(
      'Guardrail/DenyHook.ts',
    )
  })

  it('refuses an entry with an unknown key such as a shell override', () => {
    const [deny] = expectedGuardrailHooks(FORGE_ROOT)
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: deny!.matcher, hooks: [{ type: 'command', command: deny!.command, args: deny!.args, shell: 'sh' }] },
        ],
      },
    }

    expect(guardrailHooksMissingFrom(settings, FORGE_ROOT)).toContain('Guardrail/DenyHook.ts')
  })

  it('ignores a guardrail hook declared on another event than PreToolUse', () => {
    const settings = { hooks: { PostToolUse: guardrailHookSettings(FORGE_ROOT).hooks as Record<string, unknown> } }

    expect(guardrailHooksMissingFrom(settings, FORGE_ROOT)).toEqual([...guardrailHookFiles])
  })
})

describe('settingsFindingsOf', () => {
  const layer = (settings: Record<string, unknown>): { source: string; settings: Record<string, unknown> }[] => [
    { source: 'project', settings },
  ]

  it('accepts settings that only carry the forge hooks', () => {
    expect(settingsFindingsOf(layer(guardrailHookSettings(FORGE_ROOT)), {}, FORGE_ROOT, '/work')).toEqual([])
  })

  it('accepts the placeholder form this repository ships when it resolves to the checkout', () => {
    const shipped = JSON.parse(readFileSync(join(FORGE_ROOT, '.claude', 'settings.json'), 'utf8'))

    expect(settingsFindingsOf(layer(shipped), {}, FORGE_ROOT, FORGE_ROOT)).toEqual([])
  })

  it('flags a project hook that only looks like the guardrail', () => {
    const findings = settingsFindingsOf(layer(neutered('echo', ['Guardrail/DenyHook.ts'])), {}, FORGE_ROOT, '/work')

    expect(findings).toHaveLength(1)
  })

  it('flags permission rules that skip the permission layer', () => {
    const allow = { permissions: { allow: ['Bash(*)'] } }
    const mode = { permissions: { defaultMode: 'bypassPermissions' } }

    expect(settingsFindingsOf(layer(allow), {}, FORGE_ROOT, '/work')).toHaveLength(1)
    expect(settingsFindingsOf(layer(mode), {}, FORGE_ROOT, '/work')).toHaveLength(1)
  })

  it('flags disabled hooks, enabled mcp servers and permission request hooks', () => {
    expect(settingsFindingsOf(layer({}), { disableAllHooks: true }, FORGE_ROOT, '/work')).toHaveLength(1)
    expect(settingsFindingsOf(layer({ enableAllProjectMcpServers: true }), {}, FORGE_ROOT, '/work')).toHaveLength(1)
    expect(
      settingsFindingsOf(layer({ hooks: { PermissionRequest: [{ hooks: [] }] } }), {}, FORGE_ROOT, '/work'),
    ).toHaveLength(1)
  })
})

describe('assertGuardrailRegistered', () => {
  it('asks the sdk for the settings the forge declares it loads', async () => {
    resolved.mockResolvedValue({ effective: {}, sources: [] })

    await assertGuardrailRegistered('/repo', FORGE_ROOT)

    expect(resolved).toHaveBeenCalledWith({ cwd: '/repo', settingSources: [...forgeSettingSources] })
  })

  it('refuses when the project settings carry a neutered lookalike', async () => {
    const lookalike = neutered('echo', ['Guardrail/DenyHook.ts', 'Guardrail/ScopeHook.ts'])
    resolved.mockResolvedValue({ effective: lookalike, sources: [{ source: 'project', settings: lookalike }] })

    await expect(assertGuardrailRegistered('/repo', FORGE_ROOT)).rejects.toBeInstanceOf(GuardrailNotRegisteredError)
  })

  it('does not blame the user settings for their own permission rules', async () => {
    const user = { permissions: { allow: ['Read'] } }
    resolved.mockResolvedValue({ effective: user, sources: [{ source: 'user', settings: user }] })

    await expect(assertGuardrailRegistered('/repo', FORGE_ROOT)).resolves.toBeUndefined()
  })

  it('refuses when the install lacks its tsx or hook files', async () => {
    resolved.mockResolvedValue({ effective: {}, sources: [] })

    await expect(assertGuardrailRegistered('/repo', '/nowhere/forge-ops')).rejects.toBeInstanceOf(
      GuardrailNotRegisteredError,
    )
  })

  it('refuses when the settings cannot be resolved at all', async () => {
    resolved.mockRejectedValue(new Error('no settings engine'))

    await expect(assertGuardrailRegistered('/repo', FORGE_ROOT)).rejects.toBeInstanceOf(GuardrailNotRegisteredError)
  })
})
