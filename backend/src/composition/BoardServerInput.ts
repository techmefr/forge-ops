import type { serve } from '@hono/node-server'

type ServerType = ReturnType<typeof serve>

export type BoardServer = {
  server: ServerType
  port: number
  close: () => Promise<void>
}

export type BoardMode = 'local' | 'hub'

export type EnvironmentMode = 'demo' | 'real'

export type BoardServerInput = {
  port: number
  dbPath: string
  claudeHome: string
  host: string
  publicOrigin: string | null
  tokenPath: string
  distDir: string
  testsDir: string
  worktreeRoot: string
  checkoutRoots: readonly string[]
  shotDir: string
  headedPilot: boolean
  metricsUrl: string | null
  mode: BoardMode
  environmentMode: EnvironmentMode
}
