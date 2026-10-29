import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PathOutsideRootError,
  realPathInside,
  realPathInsideSync,
} from '../../../src/technical/File/ConfinedRealPath.js'

let sandbox: string
let root: string
let outside: string

beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'confined-')))
  root = join(sandbox, 'root')
  outside = join(sandbox, 'outside')
  mkdirSync(join(root, 'nested'), { recursive: true })
  mkdirSync(outside)
  writeFileSync(join(root, 'nested', 'inside.txt'), 'in')
  writeFileSync(join(outside, 'secret.txt'), 'out')
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe('realPathInsideSync', () => {
  it('returns the real path of a file under the root', () => {
    expect(realPathInsideSync(root, 'nested/inside.txt')).toBe(join(root, 'nested', 'inside.txt'))
  })

  it('refuses a parent traversal', () => {
    expect(() => realPathInsideSync(root, '../outside/secret.txt')).toThrow(PathOutsideRootError)
  })

  it('refuses an absolute path outside the root', () => {
    expect(() => realPathInsideSync(root, join(outside, 'secret.txt'))).toThrow(PathOutsideRootError)
  })

  it('refuses a symlink that leads outside the root', () => {
    symlinkSync(outside, join(root, 'escape'))
    expect(() => realPathInsideSync(root, 'escape/secret.txt')).toThrow(PathOutsideRootError)
  })

  it('accepts a symlink that stays inside the root', () => {
    symlinkSync(join(root, 'nested'), join(root, 'alias'))
    expect(realPathInsideSync(root, 'alias/inside.txt')).toBe(join(root, 'nested', 'inside.txt'))
  })

  it('refuses the root itself', () => {
    expect(() => realPathInsideSync(root, '.')).toThrow(PathOutsideRootError)
  })

  it('names the asked path on the error', () => {
    expect(() => realPathInsideSync(root, '../outside/secret.txt')).toThrow(/outside\/secret\.txt/)
  })
})

describe('realPathInside', () => {
  it('returns the real path of a file under the root', async () => {
    await expect(realPathInside(root, 'nested/inside.txt')).resolves.toBe(join(root, 'nested', 'inside.txt'))
  })

  it('refuses a parent traversal', async () => {
    await expect(realPathInside(root, '../outside/secret.txt')).rejects.toBeInstanceOf(PathOutsideRootError)
  })

  it('refuses a symlink that leads outside the root', async () => {
    symlinkSync(outside, join(root, 'escape'))
    await expect(realPathInside(root, 'escape/secret.txt')).rejects.toBeInstanceOf(PathOutsideRootError)
  })
})
