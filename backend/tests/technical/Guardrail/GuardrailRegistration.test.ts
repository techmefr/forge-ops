import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

const resolved = vi.fn()

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  resolveSettings: (input: unknown) => resolved(input),
}))

const {
  assertGuardrailRegistered,
  forgeSettingSources,
  guardrailHookFiles,
  guardrailHooksMissingFrom,
  GuardrailNotRegisteredError,
} = await import('../../../src/technical/Guardrail/GuardrailRegistration.js')

function settingsWith(files: readonly string[]): Record<string, unknown> {
  return {
    hooks: {
      PreToolUse: files.map((file) => ({
        matcher: 'Bash',
        hooks: [{ type: 'command', command: '/repo/node_modules/.bin/tsx', args: [`/repo/backend/src/technical/${file}`] }],
      })),
    },
  }
}

describe('guardrailHooksMissingFrom', () => {
  it('reports nothing missing when both guardrail hooks are declared', () => {
    expect(guardrailHooksMissingFrom(settingsWith(guardrailHookFiles))).toEqual([])
  })

  it('names the hook that no PreToolUse entry declares', () => {
    expect(guardrailHooksMissingFrom(settingsWith(['Guardrail/DenyHook.ts']))).toEqual([
      'Guardrail/ScopeHook.ts',
    ])
  })

  it('names both hooks when the settings carry none', () => {
    expect(guardrailHooksMissingFrom({})).toEqual([...guardrailHookFiles])
  })

  it('ignores a guardrail hook declared on another event than PreToolUse', () => {
    const settings = {
      hooks: {
        PostToolUse: settingsWith(guardrailHookFiles).hooks as Record<string, unknown>,
      },
    }

    expect(guardrailHooksMissingFrom(settings)).toEqual([...guardrailHookFiles])
  })

  it('ignores an entry that is not a command hook', () => {
    const settings = {
      hooks: { PreToolUse: [{ hooks: [{ type: 'prompt', command: 'Guardrail/DenyHook.ts' }] }] },
    }

    expect(guardrailHooksMissingFrom(settings)).toEqual([...guardrailHookFiles])
  })
})

describe('the settings this repository ships', () => {
  it('declares both guardrail hooks', () => {
    const shipped = JSON.parse(readFileSync(new URL('../../../../.claude/settings.json', import.meta.url), 'utf8'))

    expect(guardrailHooksMissingFrom(shipped)).toEqual([])
  })
})

describe('assertGuardrailRegistered', () => {
  it('asks the sdk for the settings the forge declares it loads', async () => {
    resolved.mockResolvedValue({ effective: settingsWith(guardrailHookFiles) })

    await assertGuardrailRegistered('/repo')

    expect(resolved).toHaveBeenCalledWith({ cwd: '/repo', settingSources: [...forgeSettingSources] })
  })

  it('refuses when a guardrail hook is not registered for the session', async () => {
    resolved.mockResolvedValue({ effective: settingsWith(['Guardrail/DenyHook.ts']) })

    await expect(assertGuardrailRegistered('/repo')).rejects.toBeInstanceOf(GuardrailNotRegisteredError)
  })

  it('refuses when the settings cannot be resolved at all', async () => {
    resolved.mockRejectedValue(new Error('no settings engine'))

    await expect(assertGuardrailRegistered('/repo')).rejects.toBeInstanceOf(GuardrailNotRegisteredError)
  })
})
