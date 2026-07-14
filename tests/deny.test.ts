import { describe, expect, it } from 'vitest'
import { checkCommand } from '../src/deny/check.js'

const PATTERNS = ['rm -rf*', 'git push --force*', 'DROP TABLE*', '> /dev/*']

describe('checkCommand', () => {
  it('denies a command matching a wildcard pattern', () => {
    const result = checkCommand('rm -rf /home/user/project', PATTERNS)
    expect(result.isDenied).toBe(true)
    expect(result.matchedPattern).toBe('rm -rf*')
  })

  it('denies git push --force with extra arguments', () => {
    const result = checkCommand('git push --force origin main', PATTERNS)
    expect(result.isDenied).toBe(true)
  })

  it('allows a safe command', () => {
    const result = checkCommand('git status', PATTERNS)
    expect(result.isDenied).toBe(false)
    expect(result.matchedPattern).toBeNull()
  })

  it('is case-sensitive to the declared pattern', () => {
    const result = checkCommand('DROP TABLE tasks;', PATTERNS)
    expect(result.isDenied).toBe(true)
  })
})
