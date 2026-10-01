import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..', '..', '..')

function runHook(command: string): { status: number | null; stderr: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, FORGE_PHASE: 'code' }
  delete env.FORGE_DENY_PATH
  const ran = spawnSync(
    join(ROOT, 'node_modules', '.bin', 'tsx'),
    [join(ROOT, 'backend', 'src', 'technical', 'Guardrail', 'DenyHook.ts')],
    { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), env, encoding: 'utf-8' },
  )
  return { status: ran.status, stderr: ran.stderr }
}

describe('DenyHook process', () => {
  it('finds the repository deny list by default and lets a harmless command through', () => {
    expect(runHook('git status').status).toBe(0)
  })

  it('refuses a command listed in the default deny list', () => {
    expect(runHook('rm -rf /').status).toBe(2)
  })
})
