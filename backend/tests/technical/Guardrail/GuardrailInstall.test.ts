import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { guardrailHooksMissingFrom } from '../../../src/technical/Guardrail/GuardrailRegistration.js'
import {
  GuardrailInstallRefusedError,
  installGuardrails,
} from '../../../src/technical/Guardrail/GuardrailInstall.js'

const HOOK = { port: 8830, token: 'a'.repeat(64) }

let forgeRoot: string
let checkout: string

function settingsOf(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
}

beforeEach(() => {
  forgeRoot = mkdtempSync(join(tmpdir(), 'forge-install-'))
  checkout = mkdtempSync(join(tmpdir(), 'checkout-'))
  mkdirSync(join(forgeRoot, 'node_modules', '.bin'), { recursive: true })
  writeFileSync(join(forgeRoot, 'node_modules', '.bin', 'tsx'), '')
})

afterEach(() => {
  rmSync(forgeRoot, { recursive: true, force: true })
  rmSync(checkout, { recursive: true, force: true })
})

describe('installGuardrails', () => {
  it('writes the deny and scope hooks with absolute paths to the forge-ops install', () => {
    const { settingsPath } = installGuardrails({ checkout, forgeRoot })

    const settings = settingsOf(settingsPath)
    expect(guardrailHooksMissingFrom(settings)).toEqual([])
    const serialized = JSON.stringify(settings)
    expect(serialized).toContain(join(forgeRoot, 'backend', 'src', 'technical', 'Guardrail', 'DenyHook.ts'))
    expect(serialized).toContain(join(forgeRoot, 'node_modules', '.bin', 'tsx'))
    expect(serialized).not.toContain('CLAUDE_PROJECT_DIR')
  })

  it('keeps the token out of the committed settings and in the local file with owner-only mode', () => {
    const { settingsPath, localSettingsPath } = installGuardrails({ checkout, forgeRoot, hook: HOOK })

    expect(readFileSync(settingsPath, 'utf-8')).not.toContain(HOOK.token)
    expect(localSettingsPath).not.toBeNull()
    const local = readFileSync(localSettingsPath as string, 'utf-8')
    expect(local).toContain(HOOK.token)
    expect(local).toContain('http://127.0.0.1:8830/api/hooks')
    expect(statSync(localSettingsPath as string).mode & 0o077).toBe(0)
  })

  it('is idempotent and keeps settings the project already had', () => {
    mkdirSync(join(checkout, '.claude'))
    writeFileSync(
      join(checkout, '.claude', 'settings.json'),
      JSON.stringify({
        permissions: { allow: ['Bash(ls)'] },
        hooks: { PreToolUse: [{ matcher: 'Read', hooks: [{ type: 'command', command: 'mine' }] }] },
      }),
    )

    installGuardrails({ checkout, forgeRoot, hook: HOOK })
    const { settingsPath } = installGuardrails({ checkout, forgeRoot, hook: HOOK })

    const settings = settingsOf(settingsPath) as {
      permissions: unknown
      hooks: { PreToolUse: unknown[] }
    }
    expect(settings.permissions).toEqual({ allow: ['Bash(ls)'] })
    expect(settings.hooks.PreToolUse).toHaveLength(3)
    expect(JSON.stringify(settings.hooks.PreToolUse)).toContain('mine')
  })

  it('refuses a missing directory, a missing tsx and an unreadable settings file', () => {
    expect(() => installGuardrails({ checkout: join(checkout, 'nope'), forgeRoot })).toThrow(GuardrailInstallRefusedError)
    expect(() => installGuardrails({ checkout, forgeRoot: join(forgeRoot, 'elsewhere') })).toThrow(/tsx/)
    mkdirSync(join(checkout, '.claude'))
    writeFileSync(join(checkout, '.claude', 'settings.json'), '{not json')
    expect(() => installGuardrails({ checkout, forgeRoot })).toThrow(/not readable JSON/)
  })
})
