import { describe, expect, it } from 'vitest'
import { reportBites, verdictOfBites, type BiteCase } from '../../../src/domain/Gate/GateBite.js'

function biteCase(name: string, exitCode: number): BiteCase {
  return { name, rejects: `a known-bad input for ${name}`, exitCode }
}

describe('verdictOfBites', () => {
  it('bites when every known-bad input was rejected', () => {
    const verdict = verdictOfBites([biteCase('lint', 1), biteCase('typecheck', 2)])
    expect(verdict.bites).toBe(true)
    expect(verdict.accepted).toEqual([])
  })

  it('does not bite when a known-bad input was accepted', () => {
    const verdict = verdictOfBites([biteCase('lint', 0), biteCase('typecheck', 2)])
    expect(verdict.bites).toBe(false)
    expect(verdict.accepted).toEqual(['lint'])
  })

  it('does not bite when no case was exercised', () => {
    const verdict = verdictOfBites([])
    expect(verdict.bites).toBe(false)
  })
})

describe('reportBites', () => {
  it('names the step that swallowed a known-bad input', () => {
    expect(reportBites(verdictOfBites([biteCase('lint', 0)]))).toContain('lint')
  })

  it('states the proof when every step rejected its case', () => {
    expect(reportBites(verdictOfBites([biteCase('lint', 1)]))).toContain('rejected')
  })
})
