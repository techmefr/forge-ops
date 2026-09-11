import { describe, expect, it } from 'vitest'
import { runQuietly } from '../../../src/technical/Gate/CommandRun.js'

describe('runQuietly', () => {
  it('returns zero for a command that succeeds', () => {
    expect(runQuietly(process.execPath, ['-e', 'process.exit(0)'], process.cwd())).toBe(0)
  })

  it('returns the exit code of a command that fails', () => {
    expect(runQuietly(process.execPath, ['-e', 'process.exit(3)'], process.cwd())).toBe(3)
  })

  it('returns a failing code when the command does not exist', () => {
    expect(runQuietly('forge-ops-command-that-does-not-exist', [], process.cwd())).not.toBe(0)
  })
})
