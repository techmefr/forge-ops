import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChangedFile, StoryInspection, TestRun } from '../../../../contract/StoryInspectionContract.js'

const TEST_TIMEOUT_MS = 10 * 60 * 1000
const OUTPUT_BUFFER = 16 * 1024 * 1024
const OUTPUT_TAIL = 3000
const EVIDENCE_FOLDER = '.claude/'

export type StoryInspectionInput = {
  testCommandOf: (root: string) => string | null
  timeoutMs?: number
}

function gitRaw(root: string, argv: readonly string[]): string {
  return execFileSync('git', [...argv], {
    cwd: root,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: OUTPUT_BUFFER,
  })
}

function git(root: string, argv: readonly string[]): string {
  return gitRaw(root, argv).trim()
}

function attempt(work: () => void): void {
  try {
    work()
  } catch {
    return
  }
}

function lines(output: string): readonly string[] {
  return output === '' ? [] : output.split('\n')
}

function statusOf(code: string): ChangedFile['status'] {
  if (code === 'A') {
    return 'added'
  }
  return code === 'D' ? 'deleted' : 'modified'
}

export function tailOf(output: string): string {
  return output.length <= OUTPUT_TAIL ? output : output.slice(output.length - OUTPUT_TAIL)
}

export function runCommand(command: string, root: string, timeoutMs: number): TestRun {
  const finished = spawnSync(command, {
    cwd: root,
    shell: true,
    timeout: timeoutMs,
    maxBuffer: OUTPUT_BUFFER,
    encoding: 'utf-8',
  })
  const output = `${finished.stdout ?? ''}${finished.stderr ?? ''}`
  if (finished.error !== undefined || finished.signal !== null) {
    const cause = finished.error?.message ?? finished.signal
    return { exitCode: 124, output: tailOf(`${output}\nthe test command was interrupted: ${cause}`) }
  }
  return { exitCode: finished.status ?? 1, output: tailOf(output) }
}

export function createStoryInspection({
  testCommandOf,
  timeoutMs = TEST_TIMEOUT_MS,
}: StoryInspectionInput): StoryInspection {
  function runTests(root: string): TestRun {
    const command = testCommandOf(root)
    if (command === null) {
      return {
        exitCode: 127,
        output: 'the project declares no test command: set scripts.test in package.json or FORGE_TEST_COMMAND',
      }
    }
    return runCommand(command, root, timeoutMs)
  }

  return {
    headSha: (root) => git(root, ['rev-parse', '--verify', 'HEAD']),

    commitsAhead: (root, baseSha) => Number(git(root, ['rev-list', '--count', `${baseSha}..HEAD`])),

    commitLog: (root, baseSha) => lines(git(root, ['log', '--oneline', `${baseSha}..HEAD`])),

    uncommittedPaths: (root) =>
      lines(gitRaw(root, ['status', '--porcelain', '--untracked-files=all']).trimEnd())
        .map((line) => line.slice(3).trim())
        .filter((path) => path !== '' && !path.startsWith(EVIDENCE_FOLDER)),

    changedFiles: (root, baseSha) =>
      lines(git(root, ['diff', '--name-status', '--no-renames', `${baseSha}..HEAD`])).map((line) => {
        const [code = 'M', ...rest] = line.split('\t')
        return { path: rest.join('\t'), status: statusOf(code.slice(0, 1)) }
      }),

    runTests,

    runTestsWithout: (root, baseSha, removed) => {
      const scratch = mkdtempSync(join(tmpdir(), 'forge-red-'))
      const tree = join(scratch, 'tree')
      try {
        git(root, ['worktree', 'add', '--detach', tree, 'HEAD'])
        for (const file of removed) {
          if (file.status === 'added') {
            rmSync(join(tree, file.path), { force: true })
            continue
          }
          git(tree, ['checkout', baseSha, '--', file.path])
        }
        const modules = join(root, 'node_modules')
        if (existsSync(modules) && !existsSync(join(tree, 'node_modules'))) {
          symlinkSync(modules, join(tree, 'node_modules'), 'dir')
        }
        return runTests(tree)
      } finally {
        attempt(() => git(root, ['worktree', 'remove', '--force', tree]))
        rmSync(scratch, { recursive: true, force: true })
        attempt(() => git(root, ['worktree', 'prune']))
      }
    },
  }
}
