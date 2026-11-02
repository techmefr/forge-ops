import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createCodexTranscriptStore, type CodexTranscriptStore } from './CodexTranscriptStore.js'
import { codexAgentEnvironmentOf } from '../Guardrail/AgentEnvironment.js'
import { promptWithReplay } from '../Cli/ReplayPrompt.js'
import { nonEmptyLinesOf } from '../Cli/StdoutLines.js'

export type CodexLaunchOrder = {
  storyId: number
  reference: string
  phase: string
  agentName: string
  prompt: string
  model?: string
  baseUrl?: string
  effort?: string
  forgeCardId?: number
  resumeSessionId?: string
}

export type CodexSessionRunner = {
  launch: (order: CodexLaunchOrder) => Promise<{ claudeSessionId: string }>
}

export class CodexProcessFailedError extends Error {
  constructor(reference: string, code: number | null) {
    super(`le processus codex lance pour ${reference} s est arrete avec le code ${code ?? 'inconnu'}`)
    this.name = 'CodexProcessFailedError'
  }
}

export type SpawnedCodexProcess = {
  stdout: AsyncIterable<string | Buffer>
  on: (event: 'close' | 'error', listener: (arg: number | null | Error) => void) => void
}

export type CodexSessionRunnerInput = {
  cwdFor: (order: CodexLaunchOrder) => string
  onEvent: (event: { name: string; payload: Record<string, unknown> }) => void
  transcripts?: CodexTranscriptStore
  spawnCodex?: (
    args: readonly string[],
    options: { cwd: string; env: NodeJS.ProcessEnv },
  ) => SpawnedCodexProcess
}

function defaultSpawnCodex(
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): SpawnedCodexProcess {
  return spawn('codex', [...args], {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  }) as unknown as SpawnedCodexProcess
}

const CODEX_REASONING: Readonly<Record<string, string>> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'high',
  max: 'high',
}

function reasoningOf(effort: string | undefined): readonly string[] {
  const level = effort === undefined ? undefined : CODEX_REASONING[effort]
  return level === undefined ? [] : ['-c', `model_reasoning_effort="${level}"`]
}

export function createCodexSessionRunner({
  cwdFor,
  onEvent,
  transcripts = createCodexTranscriptStore(),
  spawnCodex = defaultSpawnCodex,
}: CodexSessionRunnerInput): CodexSessionRunner {
  return {
    launch: async (order: CodexLaunchOrder) => {
      const cwd = cwdFor(order)
      const prompt = promptWithReplay(order, transcripts)
      const claudeSessionId = randomUUID()

      const child = spawnCodex(['exec', '--json', ...reasoningOf(order.effort), '--cd', cwd, prompt], {
        cwd,
        env: {
          ...codexAgentEnvironmentOf(process.env),
          FORGE_STORY_REFERENCE: order.reference,
          FORGE_PHASE: order.phase,
        },
      })

      const closed = new Promise<number | null>((resolve, reject) => {
        child.on('error', (error) => reject(error as Error))
        child.on('close', (code) => resolve(code as number | null))
      })

      const lines: string[] = []
      for await (const line of nonEmptyLinesOf(child.stdout)) {
        if (lines.length === 0) {
          onEvent({
            name: 'session.working',
            payload: { reference: order.reference, phase: order.phase, claudeSessionId },
          })
        }
        lines.push(line)
        onEvent({
          name: 'session.codex_line',
          payload: { reference: order.reference, phase: order.phase, claudeSessionId, line },
        })
      }

      const code = await closed
      if (code !== 0) {
        throw new CodexProcessFailedError(order.reference, code)
      }
      transcripts.append(claudeSessionId, { prompt: order.prompt, output: lines.map((line) => `${line}\n`).join('') })
      return { claudeSessionId }
    },
  }
}
