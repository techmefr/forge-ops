import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createCodexTranscriptStore, type CodexTranscriptStore } from './CodexTranscriptStore.js'

export type CodexLaunchOrder = {
  storyId: number
  reference: string
  phase: string
  agentName: string
  prompt: string
  model?: string
  baseUrl?: string
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

function promptWithFallback(order: CodexLaunchOrder, transcripts: CodexTranscriptStore): string {
  if (order.resumeSessionId === undefined) {
    return order.prompt
  }
  const priorTranscript = transcripts.read(order.resumeSessionId)
  return priorTranscript === null
    ? order.prompt
    : `${priorTranscript}\n\n## Tour actuel\n${order.prompt}`
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
      const prompt = promptWithFallback(order, transcripts)
      const claudeSessionId = randomUUID()

      const child = spawnCodex(['exec', '--json', '--cd', cwd, prompt], {
        cwd,
        env: {
          ...process.env,
          FORGE_STORY_REFERENCE: order.reference,
          FORGE_PHASE: order.phase,
        },
      })

      const closed = new Promise<number | null>((resolve, reject) => {
        child.on('error', (error) => reject(error as Error))
        child.on('close', (code) => resolve(code as number | null))
      })

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
              name: 'session.codex_line',
              payload: { reference: order.reference, phase: order.phase, claudeSessionId, line },
            })
          }
          breakAt = buffered.indexOf('\n')
        }
      }

      const code = await closed
      if (code !== 0) {
        throw new CodexProcessFailedError(order.reference, code)
      }
      transcripts.append(claudeSessionId, { prompt: order.prompt, output })
      return { claudeSessionId }
    },
  }
}
