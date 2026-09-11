import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEvidenceFileReader } from '../../../src/technical/Evidence/EvidenceFileReader.js'
import { EVIDENCE_ROOT } from '../../../src/domain/Evidence/EvidencePath.js'

let root = ''

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), 'forge-evidence-'))
  root = join(base, 'checkout')
  const outside = join(base, 'outside')
  mkdirSync(join(root, '.claude', 'evidence'), { recursive: true })
  mkdirSync(outside)
  writeFileSync(join(outside, 'secret.txt'), 'jeton\n')
  writeFileSync(join(root, '.claude', 'evidence', 'proof.txt'), 'preuve\n')
  symlinkSync(join(outside, 'secret.txt'), join(root, '.claude', 'evidence', 'escape.txt'))
  writeFileSync(join(root, '.env'), 'FORGE_TOKEN=secret')
  symlinkSync(join(root, '.env'), join(root, '.claude', 'evidence', 'sibling.txt'))
})

describe('createEvidenceFileReader', () => {
  it('reads a proof that truly lives in the evidence tree', () => {
    const read = createEvidenceFileReader({ root, evidenceRoot: EVIDENCE_ROOT })('.claude/evidence/proof.txt')
    expect(read).toEqual({ kind: 'read', content: 'preuve\n' })
  })

  it('refuses a symlink pointing out of the evidence tree', () => {
    const read = createEvidenceFileReader({ root, evidenceRoot: EVIDENCE_ROOT })('.claude/evidence/escape.txt')
    expect(read.kind).toBe('unreadable')
  })
})

describe('the base the confinement uses', () => {
  it('refuses a link that stays in the checkout but leaves the evidence tree', () => {
    const read = createEvidenceFileReader({ root, evidenceRoot: EVIDENCE_ROOT })('.claude/evidence/sibling.txt')

    expect(read).toEqual({
      kind: 'unreadable',
      reason: 'le chemin sort de l arbre des preuves',
    })
  })
})

describe('the root the board wires in', () => {
  it('matches the evidence root the domain declares', () => {
    const wired = readFileSync(
      join(process.cwd(), 'backend/src/technical/Http/BoardServer.ts'),
      'utf-8',
    )

    expect(wired).toContain("evidenceRoot: join('.claude', 'evidence')")
    expect(EVIDENCE_ROOT).toBe('.claude/evidence/')
  })
})
