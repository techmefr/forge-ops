import { afterEach, describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { runCommand } from '../../../src/technical/Git/StoryInspection.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('runCommand', () => {
  it('hides the server secrets from the test command', () => {
    vi.stubEnv('FORGE_SUPER_ADMIN_PASSWORD', 'hunter2')
    vi.stubEnv('FORGE_SETUP_TOKEN', 'setup-secret')
    const run = runCommand('echo "[][]"', tmpdir(), 10_000)

    expect(run.output.trim()).toBe('[][]')
  })

  it('keeps PATH so the project tools still resolve', () => {
    const run = runCommand('node -e "process.exit(0)"', tmpdir(), 10_000)

    expect(run.exitCode).toBe(0)
  })

  it('stops a command that overruns its timeout', () => {
    expect(runCommand('sleep 5', tmpdir(), 200).exitCode).toBe(124)
  })
})
