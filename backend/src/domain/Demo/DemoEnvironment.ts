import { join } from 'node:path'

export type BoardMode = 'demo' | 'real'

export type BoardEnvironment = {
  mode: BoardMode
  dbPath: string
  worktreeRoot: string
  shotDir: string
  tokenPath: string
}

const DEMO_DATABASE = 'forge-demo.db'
const DEMO_WORKTREES = 'worktrees'
const DEMO_SHOTS = 'shots'
const DEMO_TOKEN = '.forge-token'

export function demoEnvironment(runRoot: string): BoardEnvironment {
  return {
    mode: 'demo',
    dbPath: join(runRoot, DEMO_DATABASE),
    worktreeRoot: join(runRoot, DEMO_WORKTREES),
    shotDir: join(runRoot, DEMO_SHOTS),
    tokenPath: join(runRoot, DEMO_TOKEN),
  }
}

export function realEnvironment(input: {
  dbPath: string
  worktreeRoot: string
  shotDir: string
  tokenPath: string
}): BoardEnvironment {
  return { mode: 'real', ...input }
}
