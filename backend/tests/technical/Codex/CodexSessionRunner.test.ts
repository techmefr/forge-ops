import { describe, expect, it } from 'vitest'
import { EventEmitter } from 'node:events'
import {
  CodexProcessFailedError,
  createCodexSessionRunner,
  type CodexLaunchOrder,
  type SpawnedCodexProcess,
} from '../../../src/technical/Codex/CodexSessionRunner.js'
import { createCodexTranscriptStore } from '../../../src/technical/Codex/CodexTranscriptStore.js'

const ORDER: CodexLaunchOrder = {
  storyId: 7,
  reference: 'FORGE-7',
  phase: 'spec',
  agentName: 'architecte',
  prompt: 'ecris la story',
}

function fakeChild(lines: readonly string[], exitCode: number | null = 0): SpawnedCodexProcess & EventEmitter {
  const emitter = new EventEmitter() as EventEmitter & SpawnedCodexProcess
  async function* stream(): AsyncGenerator<string> {
    for (const line of lines) {
      yield `${line}\n`
    }
  }
  emitter.stdout = stream()
  queueMicrotask(() => emitter.emit('close', exitCode))
  return emitter
}

describe('createCodexSessionRunner', () => {
  it('lance codex exec dans le cwd de la story et rend un identifiant de session', async () => {
    let seenArgs: readonly string[] = []
    let seenCwd = ''
    const runner = createCodexSessionRunner({
      cwdFor: () => '/tmp/forge-7',
      onEvent: () => undefined,
      spawnCodex: (args, options) => {
        seenArgs = args
        seenCwd = options.cwd
        return fakeChild(['{"type":"agent_message","text":"voila"}'])
      },
    })

    const result = await runner.launch(ORDER)

    expect(seenCwd).toBe('/tmp/forge-7')
    expect(seenArgs).toEqual(['exec', '--json', '--cd', '/tmp/forge-7', 'ecris la story'])
    expect(typeof result.claudeSessionId).toBe('string')
    expect(result.claudeSessionId.length).toBeGreaterThan(0)
  })

  it('relaie chaque ligne du flux comme un evenement de session', async () => {
    const events: { name: string; payload: Record<string, unknown> }[] = []
    const runner = createCodexSessionRunner({
      cwdFor: () => '/tmp',
      onEvent: (event) => events.push(event),
      spawnCodex: () => fakeChild(['ligne 1', 'ligne 2']),
    })

    await runner.launch(ORDER)

    expect(events.map((event) => event.name)).toEqual(['session.codex_line', 'session.codex_line'])
    expect(events[0]?.payload.line).toBe('ligne 1')
  })

  it('refuse quand le processus codex sort en erreur', async () => {
    const runner = createCodexSessionRunner({
      cwdFor: () => '/tmp',
      onEvent: () => undefined,
      spawnCodex: () => fakeChild(['echec'], 1),
    })

    await expect(runner.launch(ORDER)).rejects.toThrow(CodexProcessFailedError)
  })

  it('n a pas de reprise native : reinjecte le transcript precedent dans le prompt', async () => {
    const transcripts = createCodexTranscriptStore()
    const prompts: string[] = []
    const runner = createCodexSessionRunner({
      cwdFor: () => '/tmp',
      onEvent: () => undefined,
      transcripts,
      spawnCodex: (args) => {
        const prompt = args[args.length - 1]
        prompts.push(typeof prompt === 'string' ? prompt : '')
        return fakeChild(['reponse'])
      },
    })

    const first = await runner.launch(ORDER)
    await runner.launch({ ...ORDER, resumeSessionId: first.claudeSessionId, prompt: 'continue' })

    expect(prompts[0]).toBe('ecris la story')
    expect(prompts[1]).toContain('ecris la story')
    expect(prompts[1]).toContain('continue')
  })
})
