import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runRedReport } from '../../../src/technical/RedProof/RedProofRun.js'
import { redVerdictOf } from '../../../src/domain/RedProof/RedVerdict.js'

const CHILD_TIMEOUT_MS = 60_000

const CONFIG = "export default { test: { root: '.', include: ['suite/**/*.test.ts'] } }\n"

const ASSERTING = 'import { it, expect } from "vitest"\nit("is red", () => { expect(1).toBe(2) })\n'

const BROKEN = 'import { it } from "vitest"\nimport { gone } from "./Missing.js"\nit("x", () => { gone() })\n'

const RED_JSON =
  '{"testResults":[{"name":"Thing.test.ts","message":"","assertionResults":[{"fullName":"is red","status":"failed","failureMessages":["AssertionError: boom"]}]}]}'

let root: string

function command(): string {
  return `${join(process.cwd(), 'node_modules', '.bin', 'vitest')} run --root ${root} --reporter=json`
}

function writeSuite(name: string, source: string): void {
  writeFileSync(join(root, 'suite', name), source)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'forge-red-'))
  mkdirSync(join(root, 'suite'))
  writeFileSync(join(root, 'vitest.config.js'), CONFIG)
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('runRedReport', () => {
  it(
    'reads a failing assertion out of the test report',
    () => {
      writeSuite('Asserting.test.ts', ASSERTING)
      const report = runRedReport({ command: command(), cwd: root })

      expect(redVerdictOf(report).kind).toBe('assertion')
    },
    CHILD_TIMEOUT_MS,
  )

  it(
    'reads a collection failure out of the test report',
    () => {
      writeSuite('Broken.test.ts', BROKEN)
      const report = runRedReport({ command: command(), cwd: root })

      expect(redVerdictOf(report).kind).toBe('uncollected')
      expect(report.files[0]?.message).toMatch(/Missing\.js/)
    },
    CHILD_TIMEOUT_MS,
  )

  it('reports an unreadable report as a collection failure', () => {
    const report = runRedReport({ command: 'echo not-json', cwd: root })

    expect(redVerdictOf(report).kind).toBe('uncollected')
  })

  it('reports a command that never answers as a collection failure, whatever it already printed', () => {
    const report = runRedReport({ command: `echo '${RED_JSON}'; sleep 5`, cwd: root, timeoutMs: 300 })

    expect(redVerdictOf(report).kind).toBe('uncollected')
    expect(report.files[0]?.message).toMatch(/interrompu/)
  })
})
