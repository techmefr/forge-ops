import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createCodexTranscriptStore, type CodexTranscriptStore } from '../Codex/CodexTranscriptStore.js'
import { agentEnvironmentOf } from '../Guardrail/AgentEnvironment.js'
import { argumentsOf, type AgentManifest } from './AgentManifest.js'

export type CliLaunchOrder = {
  storyId: number
  reference: string
  phase: string
  agentName: string
  prompt: string
  model?: string
  resumeSessionId?: string
}

export type CliSessionRunner = {
  launch: (order: CliLaunchOrder) => Promise<{ claudeSessionId: string }>
}

export class AgentProcessFailedError extends Error {
  constructor(agent: string, reference: string, code: number | null) {
    super(`le processus ${agent} lance pour ${reference} s est arrete avec le code ${code ?? 'inconnu'}`)
    this.name = 'AgentProcessFailedError'
  }
}

export class AgentNotInstalledError extends Error {
  constructor(agent: string, command: string) {
    super(`${agent} n est pas installe sur cette machine : la commande ${command} est introuvable`)
    this.name = 'AgentNotInstalledError'
  }
}

export type SpawnedCliProcess = {
  stdout: AsyncIterable<string | Buffer>
  on: (event: 'close' | 'error', listener: (arg: number | null | Error) => void) => void
}

export type CliSpawn = (
  command: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => SpawnedCliProcess

export type CliSessionRunnerInput = {
  manifest: AgentManifest
  cwdFor: (order: CliLaunchOrder) => string
  onEvent: (event: { name: string; payload: Record<string, unknown> }) => void
  transcripts?: CodexTranscriptStore
  spawnProcess?: CliSpawn
}

const defaultSpawn: CliSpawn = (command, args, options) =>
  spawn(command, [...args], {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }) as unknown as SpawnedCliProcess

function promptWithFallback(order: CliLaunchOrder, transcripts: CodexTranscriptStore): string {
  if (order.resumeSessionId === undefined) {
    return order.prompt
  }
  const priorTranscript = transcripts.read(order.resumeSessionId)
  return priorTranscript === null ? order.prompt : `${priorTranscript}\n\n## Tour actuel\n${order.prompt}`
}

function isMissingCommand(error: Error): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

export function createCliSessionRunner({
  manifest,
  cwdFor,
  onEvent,
  transcripts = createCodexTranscriptStore(),
  spawnProcess = defaultSpawn,
}: CliSessionRunnerInput): CliSessionRunner {
  return {
    launch: async (order) => {
      const cwd = cwdFor(order)
      const claudeSessionId = randomUUID()
      const args = argumentsOf(manifest, {
        prompt: promptWithFallback(order, transcripts),
        cwd,
        ...(order.model === undefined ? {} : { model: order.model }),
      })

      const child = spawnProcess(manifest.command, args, {
        cwd,
        env: {
          ...agentEnvironmentOf({ source: process.env, extraPrefixes: manifest.environmentPrefixes }),
          FORGE_STORY_REFERENCE: order.reference,
          FORGE_PHASE: order.phase,
        },
      })

      const closed = new Promise<number | null>((resolve, reject) => {
        child.on('error', (error) => {
          const failure = error as Error
          reject(isMissingCommand(failure) ? new AgentNotInstalledError(manifest.name, manifest.command) : failure)
        })
        child.on('close', (code) => resolve(code as number | null))
      })
      closed.catch(() => undefined)

      let output = ''
      let buffered = ''
      for await (const chunk of child.stdout) {
        buffered += chunk.toString()
        let breakAt = buffered.indexOf('\n')
        while (breakAt !== -1) {
          const line = buffered.slice(0, breakAt)
          buffered = buffered.slice(breakAt + 1)
          if (line.trim() !== '') {
            output += `${line}\n`
            onEvent({
              name: `session.${manifest.name}_line`,
              payload: { reference: order.reference, phase: order.phase, claudeSessionId, line },
            })
          }
          breakAt = buffered.indexOf('\n')
        }
      }

      const code = await closed
      if (code !== 0) {
        throw new AgentProcessFailedError(manifest.name, order.reference, code)
      }
      transcripts.append(claudeSessionId, { prompt: order.prompt, output })
      return { claudeSessionId }
    },
  }
}
