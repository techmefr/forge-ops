import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export type GitProject = {
  scratch: string
  checkout: string
  origin: string
  remove: () => void
}

export function git(cwd: string, ...argv: string[]): string {
  return execFileSync('git', argv, { cwd, encoding: 'utf-8' }).trim()
}

export function commitFiles(cwd: string, files: Readonly<Record<string, string>>, message: string): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true })
    writeFileSync(join(cwd, path), content)
  }
  git(cwd, 'add', '--', ...Object.keys(files))
  git(cwd, 'commit', '-q', '-s', '-m', message)
}

export function createGitProject(): GitProject {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'forge-project-')))
  const checkout = join(scratch, 'checkout')
  const origin = join(scratch, 'origin.git')
  mkdirSync(origin)
  git(origin, 'init', '-q', '--bare', '--initial-branch=main')
  mkdirSync(checkout)
  git(checkout, 'init', '-q', '--initial-branch=main')
  git(checkout, 'config', 'user.email', 'e2e@forge-ops.test')
  git(checkout, 'config', 'user.name', 'forge-ops e2e')
  git(checkout, 'remote', 'add', 'origin', origin)
  commitFiles(
    checkout,
    {
      'package.json': `${JSON.stringify({ name: 'sample', type: 'module', scripts: { test: 'node --test' } }, null, 2)}\n`,
      '.gitignore': 'node_modules\n',
      'README.md': 'sample project\n',
    },
    'chore: initial commit',
  )
  git(checkout, 'push', '-q', '--set-upstream', 'origin', 'main')
  return { scratch, checkout, origin, remove: () => rmSync(scratch, { recursive: true, force: true }) }
}

export const MULTIPLY_SOURCE = 'export function multiply(left, right) {\n  return left * right\n}\n'

export const MULTIPLY_TEST = [
  "import test from 'node:test'",
  "import assert from 'node:assert/strict'",
  "import { multiply } from '../src/multiply.js'",
  '',
  "test('multiplies two numbers', () => {",
  '  assert.equal(multiply(2, 3), 6)',
  '})',
  '',
].join('\n')

export const UNRELATED_TEST = [
  "import test from 'node:test'",
  "import assert from 'node:assert/strict'",
  '',
  "test('arithmetic still works', () => {",
  '  assert.equal(1 + 1, 2)',
  '})',
  '',
].join('\n')
