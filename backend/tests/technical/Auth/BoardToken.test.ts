import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  deriveHookToken,
  resolveBoardToken,
  TokenUnreadableError,
} from '../../../src/technical/Auth/BoardToken.js'

let home: string
let path: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'forge-token-'))
  path = join(home, '.forge-token')
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('resolveBoardToken', () => {
  it('writes a token when none exists yet', () => {
    const token = resolveBoardToken(path)

    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(readFileSync(path, 'utf-8').trim()).toBe(token)
  })

  it('keeps the token it already wrote', () => {
    const first = resolveBoardToken(path)

    expect(resolveBoardToken(path)).toBe(first)
  })

  it('draws a different token for a different board', () => {
    const other = join(home, 'autre-token')

    expect(resolveBoardToken(path)).not.toBe(resolveBoardToken(other))
  })

  it('keeps the file readable by its owner only', () => {
    resolveBoardToken(path)

    expect(statSync(path).mode & 0o777).toBe(0o600)
  })

  it('refuses a token too short to resist a guess', () => {
    writeFileSync(path, 'court', 'utf-8')

    expect(() => resolveBoardToken(path)).toThrow(TokenUnreadableError)
  })

  it('refuses an empty token file instead of running without a token', () => {
    writeFileSync(path, '   \n', 'utf-8')

    expect(() => resolveBoardToken(path)).toThrow(TokenUnreadableError)
  })

  it('derives a hook secret that is not the board token', () => {
    const token = resolveBoardToken(path)

    expect(deriveHookToken(token)).not.toBe(token)
  })

  it('derives the same hook secret for the same board', () => {
    const token = resolveBoardToken(path)

    expect(deriveHookToken(token)).toBe(deriveHookToken(token))
  })

  it('derives a different hook secret for a different board', () => {
    expect(deriveHookToken('a'.repeat(64))).not.toBe(deriveHookToken('b'.repeat(64)))
  })

  it('derives a hook secret that does not reveal the board token', () => {
    const token = resolveBoardToken(path)

    expect(deriveHookToken(token)).not.toContain(token.slice(0, 16))
  })

  it('refuses to run when the file cannot be read at all', () => {
    writeFileSync(path, 'f'.repeat(64), 'utf-8')
    chmodSync(path, 0o000)

    expect(() => resolveBoardToken(path)).toThrow(TokenUnreadableError)

    chmodSync(path, 0o600)
  })
})
