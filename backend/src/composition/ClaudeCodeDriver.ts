import type { AgentDriver } from '../domain/Driver/Driver.js'
import type { SessionRunner } from '../domain/Dispatch/Dispatch.js'

export const CLAUDE_CODE_DRIVER = 'claude'

export function claudeCodeDriver(runner: SessionRunner): AgentDriver {
  return {
    name: CLAUDE_CODE_DRIVER,
    abilities: ['stream', 'cost', 'resume', 'interrupt'],
    launch: runner.launch,
  }
}
