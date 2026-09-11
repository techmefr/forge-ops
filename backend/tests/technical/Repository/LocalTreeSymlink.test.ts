import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { listDirectory, readTextFile } from '../../../src/technical/Repository/LocalTree.js'
import { PathOutsideCheckoutError } from '../../../src/technical/Repository/LocalTreeViolation.js'

let root = ''
let outside = ''

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), 'forge-tree-'))
  root = join(base, 'checkout')
  outside = join(base, 'outside')
  mkdirSync(root)
  mkdirSync(outside)
  writeFileSync(join(root, 'inside.ts'), 'const kept = true\n')
  writeFileSync(join(outside, 'secret.txt'), 'jeton\n')
  symlinkSync(join(outside, 'secret.txt'), join(root, 'escape.txt'))
  symlinkSync(outside, join(root, 'escape'))
})

describe('readTextFile', () => {
  it('reads a file that truly lives in the checkout', async () => {
    const reading = await readTextFile(root, 'inside.ts', 1000)
    expect(reading.text).toBe('const kept = true\n')
  })

  it('refuses a symlink pointing out of the checkout', async () => {
    await expect(readTextFile(root, 'escape.txt', 1000)).rejects.toThrow(PathOutsideCheckoutError)
  })
})

describe('listDirectory', () => {
  it('refuses to walk into a symlinked directory pointing out of the checkout', async () => {
    await expect(listDirectory(root, 'escape')).rejects.toThrow(PathOutsideCheckoutError)
  })
})
