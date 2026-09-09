import { query } from '@anthropic-ai/claude-agent-sdk'
import type { LaunchOrder, SessionRunner } from '../../domain/Dispatch/Dispatch.js'

export type SdkSessionRunnerInput = {
  cwd: string
  onEvent: (event: { name: string; payload: Record<string, unknown> }) => void
}

export class SessionIdentifierMissingError extends Error {
  constructor(reference: string) {
    super(`la session lancee pour ${reference} n'a rendu aucun identifiant`)
    this.name = 'SessionIdentifierMissingError'
  }
}

export function createSdkSessionRunner({ cwd, onEvent }: SdkSessionRunnerInput): SessionRunner {
  return {
    launch: async (order: LaunchOrder) => {
      const conversation = query({
        prompt: order.prompt,
        options: {
          cwd,
          permissionMode: 'default',
          ...(order.model === undefined ? {} : { model: order.model }),
          ...(order.baseUrl === undefined ? {} : { env: { ...process.env, ANTHROPIC_BASE_URL: order.baseUrl } }),
        },
      })

      let claudeSessionId: string | null = null
      for await (const message of conversation) {
        if (claudeSessionId === null && 'session_id' in message && typeof message.session_id === 'string') {
          claudeSessionId = message.session_id
        }
        onEvent({
          name: `session.${message.type}`,
          payload: { reference: order.reference, phase: order.phase, claudeSessionId },
        })
        if (claudeSessionId !== null) {
          break
        }
      }

      if (claudeSessionId === null) {
        throw new SessionIdentifierMissingError(order.reference)
      }

      void drain(conversation, { ...order, claudeSessionId }, onEvent)
      return { claudeSessionId }
    },
  }
}

export function textOf(message: unknown): string | null {
  if (typeof message !== 'object' || message === null) {
    return null
  }
  const inner = (message as Record<string, unknown>).message
  if (typeof inner !== 'object' || inner === null) {
    return null
  }
  const content = (inner as Record<string, unknown>).content
  if (typeof content === 'string') {
    return content.trim() === '' ? null : content
  }
  if (!Array.isArray(content)) {
    return null
  }
  const spoken = content
    .filter(
      (block): block is { type: 'text'; text: string } =>
        typeof block === 'object' &&
        block !== null &&
        (block as Record<string, unknown>).type === 'text' &&
        typeof (block as Record<string, unknown>).text === 'string',
    )
    .map((block) => block.text.trim())
    .filter((text) => text !== '')
  return spoken.length === 0 ? null : spoken.join('\n\n')
}

export function usageOf(message: unknown): Record<string, number> {
  if (typeof message !== 'object' || message === null) {
    return {}
  }
  const record = message as Record<string, unknown>
  const usage = record.usage as Record<string, unknown> | undefined
  const collected: Record<string, number> = {}
  if (typeof record.total_cost_usd === 'number') {
    collected.costUsd = record.total_cost_usd
  }
  if (typeof usage?.input_tokens === 'number') {
    collected.inputTokens = usage.input_tokens
  }
  if (typeof usage?.output_tokens === 'number') {
    collected.outputTokens = usage.output_tokens
  }
  return collected
}

async function drain(
  conversation: AsyncIterable<{ type: string }>,
  order: LaunchOrder & { claudeSessionId: string },
  onEvent: SdkSessionRunnerInput['onEvent'],
): Promise<void> {
  try {
    for await (const message of conversation) {
      onEvent({
        name: `session.${message.type}`,
        payload: {
          reference: order.reference,
          phase: order.phase,
          claudeSessionId: order.claudeSessionId,
          ...usageOf(message),
          ...(textOf(message) === null ? {} : { text: textOf(message) }),
        },
      })
    }
  } catch (error) {
    onEvent({
      name: 'session.failed',
      payload: {
        reference: order.reference,
        phase: order.phase,
        message: error instanceof Error ? error.message : String(error),
      },
    })
  }
}
