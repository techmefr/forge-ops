import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDoctrineSource } from '../../../src/technical/Doctrine/DoctrineSource.js'

let forgeRoot: string
let checkout: string

function commandFile(root: string, name: string, text: string): void {
  mkdirSync(join(root, '.claude', 'commands'), { recursive: true })
  writeFileSync(join(root, '.claude', 'commands', name), text)
}

beforeEach(() => {
  forgeRoot = mkdtempSync(join(tmpdir(), 'doctrine-forge-'))
  checkout = mkdtempSync(join(tmpdir(), 'doctrine-checkout-'))
})

afterEach(() => {
  rmSync(forgeRoot, { recursive: true, force: true })
  rmSync(checkout, { recursive: true, force: true })
})

describe('createDoctrineSource', () => {
  it('serves the bundled doctrine when the project has none', () => {
    commandFile(forgeRoot, 'SPEC.md', 'bundled spec\n')
    const doctrineFor = createDoctrineSource({ forgeRoot, checkoutOf: () => checkout })

    expect(doctrineFor(1, 'SPEC.md')).toBe('bundled spec')
  })

  it('prefers the doctrine the project ships itself', () => {
    commandFile(forgeRoot, 'SPEC.md', 'bundled spec')
    commandFile(checkout, 'SPEC.md', 'project spec')
    const doctrineFor = createDoctrineSource({ forgeRoot, checkoutOf: () => checkout })

    expect(doctrineFor(1, 'SPEC.md')).toBe('project spec')
  })

  it('returns null for an unknown file and refuses path traversal', () => {
    commandFile(forgeRoot, 'SPEC.md', 'x')
    const doctrineFor = createDoctrineSource({ forgeRoot, checkoutOf: () => checkout })

    expect(doctrineFor(1, 'NOPE.md')).toBeNull()
    expect(doctrineFor(1, '../../etc/passwd.md')).toBeNull()
  })
})
