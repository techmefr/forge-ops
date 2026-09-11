import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { BOARD_COOKIE } from '../Auth/TokenGuard.js'

const LOOPBACK = '127.0.0.1'
const INDEX_PAGE = 'index.html'
const DATABASE_SUFFIXES: readonly string[] = ['', '-wal', '-shm']

export type DemoBundle = {
  built: boolean
  distDir: string
  reason: string | null
}

export type DemoAccessInput = {
  port: number
  token: string
}

export function discardDemoDatabase(dbPath: string): readonly string[] {
  const removed: string[] = []
  for (const suffix of DATABASE_SUFFIXES) {
    const target = `${dbPath}${suffix}`
    if (!existsSync(target)) {
      continue
    }
    rmSync(target, { force: true })
    removed.push(target)
  }
  return removed
}

export function inspectDemoBundle(distDir: string): DemoBundle {
  if (existsSync(join(distDir, INDEX_PAGE))) {
    return { built: true, distDir, reason: null }
  }
  return {
    built: false,
    distDir,
    reason: `aucun ${INDEX_PAGE} dans ${distDir}`,
  }
}

export function buildWebBundle(cwd: string): boolean {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const built = spawnSync(npm, ['run', 'build:web'], { cwd, stdio: 'inherit' })
  return built.status === 0
}

export function demoBoardUrl(port: number): string {
  return `http://${LOOPBACK}:${port}`
}

export function demoAccessLines({ port, token }: DemoAccessInput): readonly string[] {
  return [
    `Board de demonstration : ${demoBoardUrl(port)}`,
    `Ouvrir cette adresse depose le cookie ${BOARD_COOKIE} et le board s ouvre.`,
    'Pour parler a l API a la main, presenter le jeton en en-tete Authorization: Bearer, jamais dans l adresse.',
    `Jeton du board : ${token}`,
  ]
}
