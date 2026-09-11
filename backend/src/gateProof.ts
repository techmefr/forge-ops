import { reportBites, verdictOfBites, type BiteCase } from './domain/Gate/GateBite.js'
import { runQuietly } from './technical/Gate/CommandRun.js'

const root = process.cwd()

const attempts: readonly { name: string; rejects: string; args: readonly string[] }[] = [
  {
    name: 'lint',
    rejects: 'a source file using any',
    args: ['eslint', '--no-ignore', 'gateproof/fixtures/LintBait.ts'],
  },
  {
    name: 'build:back',
    rejects: 'a source file that does not typecheck',
    args: ['tsc', '-p', 'gateproof/fixtures/tsconfig.json'],
  },
  {
    name: 'test',
    rejects: 'a test whose expectation is false',
    args: ['vitest', 'run', '--config', 'gateproof/fixtures/vitest.config.ts'],
  },
  {
    name: 'manifest',
    rejects: 'a gate step pointed at a script package.json does not declare',
    args: ['tsx', 'backend/src/checkScripts.ts', 'forge-ops-script-that-does-not-exist'],
  },
]

const cases: BiteCase[] = attempts.map((attempt) => ({
  name: attempt.name,
  rejects: attempt.rejects,
  exitCode: runQuietly('npx', attempt.args, root),
}))

for (const one of cases) {
  const outcome = one.exitCode === 0 ? 'ACCEPTED' : `rejected (exit ${one.exitCode})`
  process.stdout.write(`${one.name}: ${one.rejects} -> ${outcome}\n`)
}

const control = runQuietly('npx', ['tsx', 'backend/src/checkScripts.ts', 'lint'], root)
if (control !== 0) {
  process.stdout.write('Gate proof inconclusive: the control case failed, so red proves nothing.\n')
  process.exit(1)
}

const verdict = verdictOfBites(cases)
process.stdout.write(`${reportBites(verdict)}\n`)
process.exit(verdict.bites ? 0 : 1)
