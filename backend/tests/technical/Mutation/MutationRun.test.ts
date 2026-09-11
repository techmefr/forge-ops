import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createCommandTestRunner,
  runMutationCheck,
  type TestVerdict,
} from '../../../src/technical/Mutation/MutationRun.js'

const SOURCE = 'export const ready = true\n'

let root: string
let target: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'forge-mutation-'))
  target = join(root, 'Thing.ts')
  writeFileSync(target, SOURCE)
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('runMutationCheck', () => {
  it('kills a mutation when the tests fail', () => {
    const outcomes = runMutationCheck({ paths: [target], runTests: () => 'failed' })

    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]?.killed).toBe(true)
    expect(outcomes[0]?.operator).toBe('boolean_literal')
  })

  it('reports a survivor when the tests stay green', () => {
    const outcomes = runMutationCheck({ paths: [target], runTests: () => 'passed' })

    expect(outcomes[0]?.killed).toBe(false)
  })

  it('runs the tests against the mutated source', () => {
    const seen: string[] = []
    runMutationCheck({
      paths: [target],
      runTests: () => {
        seen.push(readFileSync(target, 'utf-8'))
        return 'failed'
      },
    })

    expect(seen).toEqual(['export const ready = false\n'])
  })

  it('restores every mutated source once the run is over', () => {
    runMutationCheck({ paths: [target], runTests: () => 'failed' })

    expect(readFileSync(target, 'utf-8')).toBe(SOURCE)
  })

  it('restores the source when the test run throws', () => {
    expect(() =>
      runMutationCheck({
        paths: [target],
        runTests: () => {
          throw new Error('the suite blew up')
        },
      }),
    ).toThrow('the suite blew up')
    expect(readFileSync(target, 'utf-8')).toBe(SOURCE)
  })

  it('restores the source from the process exit handler', () => {
    let mutatedBeforeExit = ''
    let restoredByExitHandler = false
    runMutationCheck({
      paths: [target],
      runTests: () => {
        mutatedBeforeExit = readFileSync(target, 'utf-8')
        process.emit('exit', 0)
        restoredByExitHandler = readFileSync(target, 'utf-8') === SOURCE
        return 'failed'
      },
    })

    expect(mutatedBeforeExit).toBe('export const ready = false\n')
    expect(restoredByExitHandler).toBe(true)
  })

  it('restores the source when the process is interrupted', async () => {
    const script = join(root, 'interrupted.ts')
    const runModule = join(process.cwd(), 'backend/src/technical/Mutation/MutationRun.ts')
    writeFileSync(
      script,
      [
        `import { spawnSync } from 'node:child_process'`,
        `import { runMutationCheck } from ${JSON.stringify(runModule)}`,
        `runMutationCheck({`,
        `  paths: [${JSON.stringify(target)}],`,
        `  runTests: () => {`,
        `    console.log('mutated')`,
        `    spawnSync('sleep', ['3'])`,
        `    return 'failed'`,
        `  },`,
        `})`,
        '',
      ].join('\n'),
    )

    const child = spawn(process.execPath, ['--import', 'tsx', script], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await new Promise<void>((resolve) => {
      child.stdout.on('data', (chunk: Buffer) => {
        if (chunk.toString().includes('mutated')) {
          resolve()
        }
      })
    })
    const mutatedOnDisk = readFileSync(target, 'utf-8')
    child.kill('SIGINT')
    await new Promise<void>((resolve) => {
      child.on('exit', () => resolve())
    })

    expect(mutatedOnDisk).toBe('export const ready = false\n')
    expect(readFileSync(target, 'utf-8')).toBe(SOURCE)
  }, 60_000)

  it('stops once the run cap is reached', () => {
    writeFileSync(target, 'const a = true\nconst b = true\nconst c = true\n')

    expect(runMutationCheck({ paths: [target], runTests: () => 'failed', runCap: 2 })).toHaveLength(2)
  })

  it('ignores a path it cannot read', () => {
    expect(runMutationCheck({ paths: [join(root, 'absent.ts')], runTests: () => 'failed' })).toEqual([])
  })
})

describe('createCommandTestRunner', () => {
  it('reads a passing command as a passing suite', () => {
    const runTests: () => TestVerdict = createCommandTestRunner({ command: 'true', cwd: root })

    expect(runTests()).toBe('passed')
  })

  it('reads a failing command as a failing suite', () => {
    const runTests = createCommandTestRunner({ command: 'false', cwd: root })

    expect(runTests()).toBe('failed')
  })

  it('reads a command that overruns its timeout as a failing suite', () => {
    const runTests = createCommandTestRunner({ command: 'sleep 5', cwd: root, timeoutMs: 200 })

    expect(runTests()).toBe('failed')
  })
})
