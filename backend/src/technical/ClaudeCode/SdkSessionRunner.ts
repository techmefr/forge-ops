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

      void drain(conversation, order, onEvent)
      return { claudeSessionId }
    },
  }
}

async function drain(
  conversation: AsyncIterable<{ type: string }>,
  order: LaunchOrder,
  onEvent: SdkSessionRunnerInput['onEvent'],
): Promise<void> {
  try {
    for await (const message of conversation) {
      onEvent({
        name: `session.${message.type}`,
        payload: { reference: order.reference, phase: order.phase },
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
