import { beforeEach, describe, expect, it, vi } from 'vitest'

const queried = vi.fn()
const resolved = vi.fn()

const REGISTERED = {
  effective: {
    hooks: {
      PreToolUse: [
        { hooks: [{ type: 'command', command: 'tsx', args: ['backend/src/technical/Guardrail/DenyHook.ts'] }] },
        { hooks: [{ type: 'command', command: 'tsx', args: ['backend/src/technical/Guardrail/ScopeHook.ts'] }] },
      ],
    },
  },
}

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (input: unknown) => queried(input),
  resolveSettings: (input: unknown) => resolved(input),
}))

const { createSdkSessionRunner } = await import('../../../src/technical/ClaudeCode/SdkSessionRunner.js')
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

function conversationOf(messages: readonly Record<string, unknown>[]): AsyncIterable<{ type: string }> {
  async function* once(): AsyncGenerator<{ type: string }> {
    for (const message of messages) {
      yield message as { type: string }
    }
  }
  const walking = once()
  return { [Symbol.asyncIterator]: () => walking }
}

const SPOKEN = [
  { type: 'system', session_id: 'sess-7' },
  { type: 'assistant', session_id: 'sess-7', message: { role: 'assistant', content: [{ type: 'text', text: 'voila la story' }] } },
  { type: 'result', session_id: 'sess-7', total_cost_usd: 0.12, usage: { input_tokens: 40, output_tokens: 9 } },
]

describe('createSdkSessionRunner', () => {
  beforeEach(() => {
    queried.mockReset()
    resolved.mockReset()
    resolved.mockResolvedValue(REGISTERED)
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
    resolved.mockResolvedValue({ effective: {} })
    const runner = createSdkSessionRunner({
      cwdFor: () => '/tmp',
      live: createLiveSessions<SdkUserTurn>(),
      onEvent: () => undefined,
    })

    await expect(runner.launch(ORDER)).rejects.toThrow('DenyHook.ts')
    expect(queried).not.toHaveBeenCalled()
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
