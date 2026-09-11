import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { realPathInsideSync } from '../File/ConfinedRealPath.js'
import {
  MUTATION_PER_FILE_CAP,
  MUTATION_RUN_CAP,
  MUTATION_TEST_TIMEOUT_MS,
  type MutationOutcome,
} from '../../domain/Mutation/Mutation.js'
import { mutationsOfSource } from '../../domain/Mutation/MutationOperator.js'

export type TestVerdict = 'passed' | 'failed'

export type MutationRunInput = {
  paths: readonly string[]
  runTests: () => TestVerdict
  root?: string
  perFileCap?: number
  runCap?: number
}

export type CommandTestRunnerInput = {
  command: string
  cwd: string
  timeoutMs?: number
}

const INTERRUPTIONS = ['SIGINT', 'SIGTERM'] as const

const originals = new Map<string, string>()

let guarded = false

export function restoreMutatedSources(): void {
  for (const [path, source] of originals) {
    try {
      writeFileSync(path, source)
    } catch {
      continue
    }
  }
  originals.clear()
}

function guardOnce(): void {
  if (guarded) {
    return
  }
  guarded = true
  process.on('exit', restoreMutatedSources)
  for (const interruption of INTERRUPTIONS) {
    process.on(interruption, () => {
      restoreMutatedSources()
      process.exit(130)
    })
  }
}

function confinedTarget(root: string, asked: string): string | null {
  if (asked.includes(String.fromCharCode(0))) {
    return null
  }
  try {
    return realPathInsideSync(root, asked)
  } catch {
    return null
  }
}

function readSource(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

export function runMutationCheck({
  paths,
  runTests,
  perFileCap = MUTATION_PER_FILE_CAP,
  runCap = MUTATION_RUN_CAP,
  root = process.cwd(),
}: MutationRunInput): readonly MutationOutcome[] {
  guardOnce()
  const outcomes: MutationOutcome[] = []
  for (const asked of paths) {
    const path = confinedTarget(root, asked)
    if (path === null) {
      continue
    }
    const original = readSource(path)
    if (original === null) {
      continue
    }
    for (const mutation of mutationsOfSource(path, original, perFileCap)) {
      if (outcomes.length >= runCap) {
        return outcomes
      }
      originals.set(path, original)
      try {
        writeFileSync(path, mutation.source)
        outcomes.push({
          path: mutation.path,
          operator: mutation.operator,
          line: mutation.line,
          killed: runTests() === 'failed',
        })
      } finally {
        if (originals.has(path)) {
          writeFileSync(path, original)
          originals.delete(path)
        }
      }
    }
  }
  return outcomes
}

export function createCommandTestRunner({
  command,
  cwd,
  timeoutMs = MUTATION_TEST_TIMEOUT_MS,
}: CommandTestRunnerInput): () => TestVerdict {
  return () => {
    const result = spawnSync(command, {
      cwd,
      shell: true,
      timeout: timeoutMs,
      stdio: 'ignore',
    })
    return result.status === 0 ? 'passed' : 'failed'
  }
}
