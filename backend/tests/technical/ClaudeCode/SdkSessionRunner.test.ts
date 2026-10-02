import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const queried = vi.fn()
const resolved = vi.fn()

const REGISTERED = { effective: {}, sources: [] }

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (input: unknown) => queried(input),
  resolveSettings: (input: unknown) => resolved(input),
}))

const { createSdkSessionRunner, createSdkSessionTalker, failureOf, STOP_GRACE_MS } = await import('../../../src/technical/ClaudeCode/SdkSessionRunner.js')
const { createGuardrailSeal } = await import('../../../src/technical/Guardrail/GuardrailSeal.js')
const { createLiveSessions } = await import('../../../src/technical/ClaudeCode/LiveSessions.js')
import type { SdkUserTurn } from '../../../src/technical/ClaudeCode/TurnDelivery.js'

const ORDER = {
  storyId: 7,
  reference: 'FORGE-7',
  phase: 'spec' as const,
  agentName: 'architecte',
  prompt: 'ecris la story',
  lens: null,
}

const closed = vi.fn()
const interrupted = vi.fn()

function conversationOf(
  messages: readonly Record<string, unknown>[],
): AsyncIterable<{ type: string }> & { close: () => void; interrupt: () => Promise<undefined> } {
  async function* once(): AsyncGenerator<{ type: string }> {
    for (const message of messages) {
      yield message as { type: string }
    }
  }
  const walking = once()
  return { [Symbol.asyncIterator]: () => walking, close: closed, interrupt: interrupted }
}

const SPOKEN = [
  { type: 'system', session_id: 'sess-7' },
  { type: 'assistant', session_id: 'sess-7', message: { role: 'assistant', content: [{ type: 'text', text: 'voila la story' }] } },
  { type: 'result', session_id: 'sess-7', total_cost_usd: 0.12, usage: { input_tokens: 40, output_tokens: 9 } },
]

describe('createSdkSessionRunner', () => {
  beforeEach(() => {
    queried.mockReset()
    closed.mockReset()
    interrupted.mockReset()
    interrupted.mockResolvedValue(undefined)
    resolved.mockReset()
    resolved.mockResolvedValue(REGISTERED)
  })

  it('hands the sdk a permission callback bound to the phase and the session directory', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    await runner.launch({ ...ORDER, phase: 'code' })

    const options = queried.mock.calls[0]![0].options
    expect(await options.canUseTool('Write', { file_path: '/tmp/a.ts' })).toEqual({ behavior: 'allow' })
    expect((await options.canUseTool('Write', { file_path: '/etc/a' })).behavior).toBe('deny')
  })

  it('declares the settings sources it relies on instead of inheriting the sdk default', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    await runner.launch(ORDER)

    expect(queried).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ settingSources: ['user', 'project', 'local'] }),
      }),
    )
  })

  it('resolves cwd per order instead of a fixed directory', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const cwdFor = vi.fn(() => '/worktrees/forge-7')
    const runner = createSdkSessionRunner({
      cwdFor,
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    await runner.launch(ORDER)

    expect(cwdFor).toHaveBeenCalledWith(ORDER)
    expect(queried).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ cwd: '/worktrees/forge-7' }) }),
    )
  })

  it('refuses to open a session when the guardrail is not registered', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const neutered = {
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo', args: ['Guardrail/DenyHook.ts'] }] }] },
    }
    resolved.mockResolvedValue({ effective: neutered, sources: [{ source: 'project', settings: neutered }] })
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    await expect(runner.launch(ORDER)).rejects.toThrow('not the forge guardrail')
    expect(queried).not.toHaveBeenCalled()
  })

  it('injects the exact guardrail hooks through the sdk options instead of trusting files', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
      forgeRoot: process.cwd(),
    })

    await runner.launch(ORDER)

    const injected = queried.mock.calls[0]![0].options.settings
    const entries = injected.hooks.PreToolUse
    expect(entries.map((entry: { matcher: string }) => entry.matcher)).toEqual([
      'Bash|PowerShell',
      'Write|Edit|MultiEdit|NotebookEdit',
    ])
    expect(entries[0].hooks[0].command).toBe(join(process.cwd(), 'node_modules', '.bin', 'tsx'))
    expect(entries[0].hooks[0].args).toEqual([join(process.cwd(), 'backend', 'src', 'technical', 'Guardrail', 'DenyHook.ts')])
  })

  it('fails the session and refuses the next launch when the guardrail files changed during a turn', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const events: { name: string; payload: Record<string, unknown> }[] = []
    const folder = mkdtempSync(join(tmpdir(), 'runner-tamper-'))
    mkdirSync(join(folder, '.claude'), { recursive: true })
    writeFileSync(join(folder, '.claude', 'settings.json'), '{}')
    const seal = createGuardrailSeal(process.cwd())
    const runner = createSdkSessionRunner({
      cwdFor: () => folder,
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: (event) => events.push(event),
      seal,
    })
    queried.mockImplementation(() => {
      writeFileSync(join(folder, '.claude', 'settings.json'), '{"permissions":{"allow":["Bash(*)"]}}')
      return conversationOf(SPOKEN)
    })

    await runner.launch(ORDER)
    await vi.waitFor(() => expect(events.some((event) => event.name === 'session.failed')).toBe(true))

    const failure = events.find((event) => event.name === 'session.failed')
    expect(String(failure?.payload.message)).toContain('.claude/settings.json')
    expect(closed).toHaveBeenCalled()
    await expect(runner.launch(ORDER)).rejects.toThrow('guardrail files changed')
    rmSync(folder, { recursive: true, force: true })
  })

  it('hands back the session identifier the sdk announced', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    expect(await runner.launch(ORDER)).toEqual({ claudeSessionId: 'sess-7' })
  })

  it('keeps reading the conversation once the identifier is known', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const seen: { name: string; payload: Record<string, unknown> }[] = []
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: (event) => seen.push(event),
    })

    await runner.launch(ORDER)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(seen.map((event) => event.payload.text).filter((text) => text !== undefined)).toEqual([
      'voila la story',
    ])
  })

  it('reports the cost the sdk announced at the end of the turn', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const seen: { name: string; payload: Record<string, unknown> }[] = []
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: (event) => seen.push(event),
    })

    await runner.launch(ORDER)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(seen.at(-1)).toEqual({
      name: 'session.result',
      payload: {
        reference: 'FORGE-7',
        phase: 'spec',
        claudeSessionId: 'sess-7',
        costUsd: 0.12,
        inputTokens: 40,
        outputTokens: 9,
      },
    })
  })

  it('reports the widest context window it saw across the models used this turn', async () => {
    const spoken = [
      { type: 'system', session_id: 'sess-7' },
      {
        type: 'result',
        session_id: 'sess-7',
        total_cost_usd: 0.12,
        usage: { input_tokens: 40, output_tokens: 9 },
        modelUsage: {
          'claude-haiku-4-5': { contextWindow: 200000, inputTokens: 10, outputTokens: 2 },
          'claude-opus-4-7': {
            contextWindow: 1000000,
            inputTokens: 400,
            outputTokens: 90,
            cacheReadInputTokens: 500,
            cacheCreationInputTokens: 10,
          },
        },
      },
    ]
    queried.mockReturnValue(conversationOf(spoken))
    const seen: { name: string; payload: Record<string, unknown> }[] = []
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: (event) => seen.push(event),
    })

    await runner.launch(ORDER)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(seen.at(-1)?.payload.contextWindow).toBe(1000000)
    expect(seen.at(-1)?.payload.contextTokens).toBe(1000)
  })

  it('leaves the context reading out when the sdk never sent a modelUsage entry', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const seen: { name: string; payload: Record<string, unknown> }[] = []
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: (event) => seen.push(event),
    })

    await runner.launch(ORDER)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(seen.at(-1)?.payload.contextWindow).toBeUndefined()
    expect(seen.at(-1)?.payload.contextTokens).toBeUndefined()
  })

  it('resumes the claude agent sdk session when the order carries one to continue', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    await runner.launch({ ...ORDER, resumeSessionId: 'sess-old' })

    expect(queried).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ resume: 'sess-old' }) }),
    )
  })

  it('opens a bare session when the order carries no session to continue', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    await runner.launch(ORDER)

    const call = queried.mock.calls[0]?.[0] as { options: Record<string, unknown> }
    expect(call.options.resume).toBeUndefined()
  })

  it('still applies the turn model even while resuming a session', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    await runner.launch({ ...ORDER, resumeSessionId: 'sess-old', model: 'claude-haiku-4-5' })

    expect(queried).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ resume: 'sess-old', model: 'claude-haiku-4-5' }),
      }),
    )
  })

  it('interrupts the started conversation when its session is abandoned', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const live = createLiveSessions<SdkUserTurn>()
    const runner = createSdkSessionRunner({ cwdFor: () => '/tmp', live, onEvent: () => undefined })
    await runner.launch(ORDER)

    runner.abandon?.('sess-7')

    expect(interrupted).toHaveBeenCalledTimes(1)
    expect(live.find('sess-7')).toBeNull()
  })

  it('hanging up a session interrupts its process and forces it closed when it does not end', async () => {
    vi.useFakeTimers()
    try {
      const neverEnding: AsyncIterable<{ type: string; session_id: string }> & {
        close: () => void
        interrupt: () => Promise<undefined>
      } = {
        async *[Symbol.asyncIterator] () {
          yield { type: 'system', session_id: 'sess-9' }
          await new Promise(() => undefined)
        },
        close: closed,
        interrupt: interrupted,
      }
      queried.mockReturnValue(neverEnding)
      const live = createLiveSessions<SdkUserTurn>()
      const runner = createSdkSessionRunner({ cwdFor: () => '/tmp', live, onEvent: () => undefined })
      const talker = createSdkSessionTalker({ live, onEvent: () => undefined })
      await runner.launch(ORDER)

      talker.hangUp('sess-9')

      expect(interrupted).toHaveBeenCalledTimes(1)
      expect(closed).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(STOP_GRACE_MS)
      expect(closed).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not force a conversation closed once it ended by itself after the interrupt', async () => {
    vi.useFakeTimers()
    try {
      queried.mockReturnValue(conversationOf(SPOKEN))
      const live = createLiveSessions<SdkUserTurn>()
      const runner = createSdkSessionRunner({ cwdFor: () => '/tmp', live, onEvent: () => undefined })
      await runner.launch(ORDER)
      runner.abandon?.('sess-7')

      await vi.advanceTimersByTimeAsync(STOP_GRACE_MS * 2)

      expect(closed).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('refuses a conversation that never announced an identifier', async () => {
    queried.mockReturnValue(conversationOf([{ type: 'system' }]))
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    await expect(runner.launch(ORDER)).rejects.toThrow('FORGE-7')
  })

  it('frees the live channel once the conversation is drained', async () => {
    queried.mockReturnValue(conversationOf(SPOKEN))
    const live = createLiveSessions<SdkUserTurn>()
    const runner = createSdkSessionRunner({ cwdFor: () => '/tmp', live, onEvent: () => undefined })

    await runner.launch(ORDER)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(live.find('sess-7')).toBeNull()
  })
})

describe('failureOf', () => {
  it('reads a failed result', () => {
    expect(failureOf({ type: 'result', is_error: true, result: 'Failed to authenticate' })).toBe('Failed to authenticate')
    expect(failureOf({ type: 'result', subtype: 'error_max_turns' })).toBe('error_max_turns')
  })

  it('reads an assistant message that reports an error', () => {
    const message = { type: 'assistant', error: 'authentication_failed', message: { content: [{ type: 'text', text: 'Failed to authenticate' }] } }
    expect(failureOf(message)).toBe('Failed to authenticate')
  })

  it('leaves normal messages alone', () => {
    expect(failureOf({ type: 'result', subtype: 'success', is_error: false, result: 'ok' })).toBeNull()
    expect(failureOf({ type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }] } })).toBeNull()
    expect(failureOf(null)).toBeNull()
  })
})

describe('a session that fails after it started', () => {
  it('reports the failure with the session id so the ledger can close it', async () => {
    const events: { name: string; payload: Record<string, unknown> }[] = []
    resolved.mockResolvedValue(REGISTERED)
    queried.mockReturnValue(
      conversationOf([
        { type: 'system', session_id: 'sess-9' },
        { type: 'result', session_id: 'sess-9', is_error: true, result: 'Failed to authenticate' },
      ]),
    )
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      onEvent: (event) => events.push(event),
      live: createLiveSessions<SdkUserTurn>(),
    })
    await runner.launch(ORDER)
    await vi.waitFor(() => expect(events.some((event) => event.name === 'session.result')).toBe(true))
    const result = events.find((event) => event.name === 'session.result')
    expect(result?.payload).toMatchObject({ claudeSessionId: 'sess-9', isError: true })
  })
})

describe('createSdkSessionRunner environment', () => {
  it('does not hand the server secrets to the agent process', async () => {
    resolved.mockResolvedValue(REGISTERED)
    queried.mockReturnValue(conversationOf(SPOKEN))
    process.env.FORGE_SUPER_ADMIN_PASSWORD = 'leak-me'
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    await runner.launch(ORDER)
    delete process.env.FORGE_SUPER_ADMIN_PASSWORD

    const env = (queried.mock.calls.at(-1)?.[0] as { options: { env: Record<string, string> } }).options.env
    expect(env.FORGE_SUPER_ADMIN_PASSWORD).toBeUndefined()
    expect(env.FORGE_STORY_REFERENCE).toBe('FORGE-7')
    expect(env.FORGE_PHASE).toBe('spec')
  })
})
