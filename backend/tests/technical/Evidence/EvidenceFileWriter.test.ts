import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EvidenceWriteRefusedError, writeEvidenceFile } from '../../../src/technical/Evidence/EvidenceFileWriter.js'

let scratch: string
let root: string

beforeEach(() => {
  scratch = realpathSync(mkdtempSync(join(tmpdir(), 'forge-evidence-')))
  root = join(scratch, 'worktree')
  mkdirSync(root)
})

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('writeEvidenceFile', () => {
  it('writes a proof under the evidence folder, creating the folders', () => {
    writeEvidenceFile(root, '.claude/evidence/FORGE-1/build_done.checked.md', 'proof')

    expect(readFileSync(join(root, '.claude/evidence/FORGE-1/build_done.checked.md'), 'utf-8')).toBe('proof')
  })

  it('refuses a path outside the evidence folder', () => {
    expect(() => writeEvidenceFile(root, 'src/index.ts', 'x')).toThrow(EvidenceWriteRefusedError)
    expect(() => writeEvidenceFile(root, '.claude/evidence/../settings.json', 'x')).toThrow(EvidenceWriteRefusedError)
  })

  it('refuses an evidence folder that is a link out of the worktree', () => {
    const outside = join(scratch, 'outside')
    mkdirSync(outside)
    mkdirSync(join(root, '.claude'))
    symlinkSync(outside, join(root, '.claude', 'evidence'), 'dir')

    expect(() => writeEvidenceFile(root, '.claude/evidence/FORGE-1/x.md', 'x')).toThrow(EvidenceWriteRefusedError)
  })
})
