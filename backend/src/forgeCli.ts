import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as prompts from '@clack/prompts'
import { applyAnswers, askAnswers } from './composition/SetupWizard.js'
import { diagnose, type Check } from './technical/Setup/Doctor.js'
import { secretPath } from './technical/Setup/SetupFiles.js'
import { generatedSecretsOf } from './domain/Setup/SetupPlan.js'

const DOCKER_DIRECTORY = resolve('docker')
const HEALTH_URL = 'http://localhost:4311/health'
const HEALTH_TIMEOUT_MS = 3000

function run(command: string, args: readonly string[]): Promise<boolean> {
  return new Promise((done) => {
    const child = spawn(command, [...args], { stdio: 'ignore' })
    child.on('error', () => done(false))
    child.on('close', (code) => done(code === 0))
  })
}

async function isHealthy(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
    return response.ok
  } catch {
    return false
  }
}

function composeUp(composeFile: string): Promise<boolean> {
  return new Promise((done) => {
    const child = spawn('docker', ['compose', '-f', join('docker', composeFile), 'up', '--build', '-d'], {
      stdio: 'inherit',
    })
    child.on('error', () => done(false))
    child.on('close', (code) => done(code === 0))
  })
}

function print(checks: readonly Check[]): boolean {
  for (const check of checks) {
    if (check.isOk) {
      prompts.log.success(check.label)
    } else {
      prompts.log.error(`${check.label}\n  ${check.hint}`)
    }
  }
  return checks.every((check) => check.isOk)
}

async function init(): Promise<void> {
  prompts.intro('Forge Ops setup')
  const answers = await askAnswers()
  const result = applyAnswers(answers, DOCKER_DIRECTORY)
  if (result.adminPassword !== null) {
    prompts.note(`${answers.superAdminLogin} / ${result.adminPassword}`, 'First super admin (shown once, change it after signing in)')
  }
  const isStarting = await prompts.confirm({ message: 'Start it now with docker compose?', initialValue: true })
  if (prompts.isCancel(isStarting) || !isStarting) {
    prompts.outro(`Later: docker compose -f docker/${result.composeFile} up --build -d`)
    return
  }
  const isUp = await composeUp(result.composeFile)
  prompts.outro(isUp ? 'Running. Check it with: npm run forge-ops -- doctor' : 'Docker failed, see the output above.')
}

async function doctor(): Promise<void> {
  prompts.intro('Forge Ops doctor')
  const isOk = print(
    await diagnose({
      run,
      hasSecret: (name) => existsSync(secretPath(DOCKER_DIRECTORY, name)),
      isHealthy,
      secrets: generatedSecretsOf('laptop'),
      healthUrl: HEALTH_URL,
    }),
  )
  prompts.outro(isOk ? 'All good.' : 'Fix the lines above and run doctor again.')
  process.exitCode = isOk ? 0 : 1
}

const command = process.argv[2] ?? 'init'
const commands: Readonly<Record<string, () => Promise<void>>> = { init, doctor }
const selected = commands[command]

if (selected === undefined) {
  process.stderr.write(`Unknown command "${command}". Use: init, doctor.\n`)
  process.exitCode = 2
} else {
  void selected().catch((error: unknown) => {
    prompts.log.error(error instanceof Error ? error.message : 'Setup failed')
    process.exitCode = 1
  })
}
