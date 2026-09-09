import { describe, expect, it } from 'vitest'
import {
  assertEvidencePath,
  EvidencePathRefusedError,
} from '../../../src/domain/Evidence/EvidencePath.js'

describe('assertEvidencePath', () => {
  it('accepts a path under the evidence root', () => {
    expect(assertEvidencePath('.claude/evidence/FORGE-1/spec.md')).toBe('.claude/evidence/FORGE-1/spec.md')
  })

  it('trims the surrounding blanks it was given', () => {
    expect(assertEvidencePath('  .claude/evidence/FORGE-1/spec.md  ')).toBe(
      '.claude/evidence/FORGE-1/spec.md',
    )
  })

  it('refuses an absolute path', () => {
    expect(() => assertEvidencePath('/etc/passwd')).toThrow(EvidencePathRefusedError)
  })

  it('refuses a path that climbs out of the evidence root', () => {
    expect(() => assertEvidencePath('.claude/evidence/../../../.ssh/id_rsa')).toThrow(
      EvidencePathRefusedError,
    )
  })

  it('refuses a path outside the evidence root', () => {
    expect(() => assertEvidencePath('src/domain/Story/Story.ts')).toThrow(EvidencePathRefusedError)
  })

  it('refuses a windows absolute path', () => {
    expect(() => assertEvidencePath('C:\\Users\\gaetan\\secrets.txt')).toThrow(EvidencePathRefusedError)
  })

  it('refuses a backslash even inside the evidence root, to keep one single form', () => {
    expect(() => assertEvidencePath('.claude/evidence\\FORGE-1\\spec.md')).toThrow(
      EvidencePathRefusedError,
    )
  })

  it('refuses a blank path', () => {
    expect(() => assertEvidencePath('   ')).toThrow(EvidencePathRefusedError)
  })

  it('refuses the evidence root itself, which proves nothing', () => {
    expect(() => assertEvidencePath('.claude/evidence/')).toThrow(EvidencePathRefusedError)
  })

  it('refuses a null byte smuggled into the path', () => {
    expect(() => assertEvidencePath('.claude/evidence/FORGE-1/spec.md\u0000.png')).toThrow(
      EvidencePathRefusedError,
    )
  })
})
