import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
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
  root: string
  runTests: () => TestVerdict
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

function readSource(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

function insideRoot(root: string, path: string): string | null {
  const base = resolve(root)
  const full = resolve(base, path)
  const inside = relative(base, full)
  if (inside === '' || inside.startsWith('..') || inside.startsWith(sep + '..') || isAbsolute(inside)) {
    return null
  }
  return full
}

export function runMutationCheck({
  paths,
  root,
  runTests,
  perFileCap = MUTATION_PER_FILE_CAP,
  runCap = MUTATION_RUN_CAP,
}: MutationRunInput): readonly MutationOutcome[] {
  guardOnce()
  const outcomes: MutationOutcome[] = []
  for (const asked of paths) {
    const path = insideRoot(root, asked)
    if (path === null) {
      continue
    }
    const original = readSource(path)
    if (original === null) {
      continue
    }
    for (const mutation of mutationsOfSource(asked, original, perFileCap)) {
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
