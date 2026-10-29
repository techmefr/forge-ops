import type { AgentDriver } from '../domain/Driver/Driver.js'
import type { SessionRunner } from '../domain/Dispatch/Dispatch.js'
import type { AgentManifest } from '../technical/Cli/AgentManifest.js'

export function cliDriver(manifest: AgentManifest, runner: SessionRunner): AgentDriver {
  return {
    name: manifest.name,
    abilities: manifest.abilities,
    launch: runner.launch,
    ...(runner.abandon === undefined ? {} : { abandon: runner.abandon }),
  }
}
