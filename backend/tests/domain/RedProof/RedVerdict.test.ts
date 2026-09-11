import { describe, expect, it } from 'vitest'
import {
  describeRedVerdict,
  redVerdictOf,
} from '../../../src/domain/RedProof/RedVerdict.js'
import type { TestReport } from '../../../src/domain/RedProof/RedProof.js'

const ASSERTION_MESSAGE = 'AssertionError: expected 1 to be 2 // Object.is equality\n    at Thing.test.ts:2:32'

function reportOf(files: TestReport['files']): TestReport {
  return { files }
}

describe('redVerdictOf', () => {
  it('accepts a suite carrying a failing assertion', () => {
    const verdict = redVerdictOf(
      reportOf([
        {
          name: 'backend/tests/domain/Thing.test.ts',
          message: '',
          assertions: [
            { fullName: 'refuses an empty scope', status: 'failed', failureMessages: [ASSERTION_MESSAGE] },
          ],
        },
      ]),
    )

    expect(verdict).toEqual({
      kind: 'assertion',
      failures: ['backend/tests/domain/Thing.test.ts > refuses an empty scope'],
    })
  })

  it('refuses a suite whose file failed to collect', () => {
    const verdict = redVerdictOf(
      reportOf([
        {
          name: 'backend/tests/domain/Thing.test.ts',
          message: "Cannot find module './Missing.js' imported from 'Thing.test.ts'",
          assertions: [],
        },
      ]),
    )

    expect(verdict.kind).toBe('uncollected')
    expect(describeRedVerdict(verdict)).toMatch(/Cannot find module/)
  })

  it('refuses an uncollected file even when another file asserts red', () => {
    const verdict = redVerdictOf(
      reportOf([
        {
          name: 'backend/tests/domain/Broken.test.ts',
          message: 'Failed to parse source for import analysis',
          assertions: [],
        },
        {
          name: 'backend/tests/domain/Thing.test.ts',
          message: '',
          assertions: [{ fullName: 'is red', status: 'failed', failureMessages: [ASSERTION_MESSAGE] }],
        },
      ]),
    )

    expect(verdict.kind).toBe('uncollected')
  })

  it('refuses a suite that is entirely green', () => {
    const verdict = redVerdictOf(
      reportOf([
        {
          name: 'backend/tests/domain/Thing.test.ts',
          message: '',
          assertions: [{ fullName: 'is green', status: 'passed', failureMessages: [] }],
        },
      ]),
    )

    expect(verdict.kind).toBe('green')
    expect(describeRedVerdict(verdict)).toMatch(/aucun test/)
  })

  it('refuses an empty suite', () => {
    expect(redVerdictOf(reportOf([])).kind).toBe('empty')
  })

  it('refuses a file that ran no test at all', () => {
    const verdict = redVerdictOf(
      reportOf([{ name: 'backend/tests/domain/Thing.test.ts', message: '', assertions: [] }]),
    )

    expect(verdict.kind).toBe('empty')
  })

  it('refuses a red that is a crash rather than an assertion', () => {
    const verdict = redVerdictOf(
      reportOf([
        {
          name: 'backend/tests/domain/Thing.test.ts',
          message: '',
          assertions: [
            { fullName: 'blows up', status: 'failed', failureMessages: ['TypeError: x is not a function'] },
          ],
        },
      ]),
    )

    expect(verdict.kind).toBe('crashed')
    expect(describeRedVerdict(verdict)).toMatch(/blows up/)
  })

  it('accepts a mixed suite where one assertion failed and another passed', () => {
    const verdict = redVerdictOf(
      reportOf([
        {
          name: 'backend/tests/domain/Thing.test.ts',
          message: '',
          assertions: [
            { fullName: 'is red', status: 'failed', failureMessages: [ASSERTION_MESSAGE] },
            { fullName: 'is green', status: 'passed', failureMessages: [] },
          ],
        },
      ]),
    )

    expect(verdict.kind).toBe('assertion')
  })

  it('caps the failures it lists', () => {
    const assertions = Array.from({ length: 9 }, (_, index) => ({
      fullName: `case ${index}`,
      status: 'failed' as const,
      failureMessages: [ASSERTION_MESSAGE],
    }))
    const verdict = redVerdictOf(
      reportOf([{ name: 'backend/tests/domain/Thing.test.ts', message: '', assertions }]),
    )

    expect(verdict.kind === 'assertion' && verdict.failures).toHaveLength(5)
  })
})
