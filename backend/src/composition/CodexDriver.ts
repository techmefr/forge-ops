import type { AgentDriver } from '../domain/Driver/Driver.js'
import type { SessionRunner } from '../domain/Dispatch/Dispatch.js'

export const CODEX_DRIVER = 'codex'

export function codexDriver(runner: SessionRunner): AgentDriver {
  return {
    name: CODEX_DRIVER,
    abilities: ['stream'],
    launch: runner.launch,
  }
}
