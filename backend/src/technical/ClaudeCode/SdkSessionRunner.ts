import { query } from '@anthropic-ai/claude-agent-sdk'
import type { LaunchOrder, SessionRunner } from '../../domain/Dispatch/Dispatch.js'
import type { SessionTalker, SpokenTurn } from '../../domain/Conversation/Conversation.js'
import type { LiveSessions } from './LiveSessions.js'
import { deliverTurn, userTurn, type SdkUserTurn } from './TurnDelivery.js'
import { WORKFLOW_EFFORTS, type WorkflowEffort } from '../../../../contract/WorkflowColumnContract.js'
import type { Settings } from '@anthropic-ai/claude-agent-sdk'
import { agentEnvironmentOf } from '../Guardrail/AgentEnvironment.js'
import { decideToolPermission } from '../Guardrail/ToolPermission.js'
import {
  assertGuardrailRegistered,
  forgeSettingSources,
  GuardrailNotRegisteredError,
  guardrailHookSettings,
} from '../Guardrail/GuardrailRegistration.js'
import { createGuardrailSeal, type GuardrailSeal } from '../Guardrail/GuardrailSeal.js'
import { EMPTY_SHELL_SEED, shellEnvOf, type ShellSeed } from '../Guardrail/ShellPolicy.js'

function effortOptionOf(order: LaunchOrder): { effort?: WorkflowEffort } {
  const effort = WORKFLOW_EFFORTS.find((candidate) => candidate === order.effort)
  return effort === undefined ? {} : { effort }
}

export const STOP_GRACE_MS = 3000

export type SdkSessionRunnerInput = {
  cwdFor: (order: LaunchOrder) => string
  onEvent: (event: { name: string; payload: Record<string, unknown> }) => void
  live: LiveSessions<SdkUserTurn>
  forgeRoot?: string
  seal?: GuardrailSeal
  shellSeedFor?: (order: LaunchOrder) => ShellSeed
}

export class SessionIdentifierMissingError extends Error {
  constructor(reference: string) {
    super(`la session lancee pour ${reference} n'a rendu aucun identifiant`)
    this.name = 'SessionIdentifierMissingError'
  }
}

export function createSdkSessionRunner({
  cwdFor,
  onEvent,
  live,
  forgeRoot = process.cwd(),
  seal = createGuardrailSeal(forgeRoot),
  shellSeedFor,
}: SdkSessionRunnerInput): SessionRunner {
  return {
    launch: async (order: LaunchOrder) => {
      const cwd = cwdFor(order)
      const tampered = seal.tamperedReason(cwd)
      if (tampered !== null) {
        throw new GuardrailNotRegisteredError(tampered)
      }
      await assertGuardrailRegistered(cwd, forgeRoot)
      seal.seal(cwd)
      const shell = shellSeedFor?.(order) ?? EMPTY_SHELL_SEED
      const started = live.start()
      started.channel.push(userTurn(order.prompt))
      const conversation = query({
        prompt: started.channel,
        options: {
          cwd,
          settingSources: [...forgeSettingSources],
          settings: guardrailHookSettings(forgeRoot) as Settings,
          permissionMode: 'default',
          canUseTool: (tool, input) =>
            Promise.resolve(decideToolPermission({ phase: order.phase, tool, input, root: cwd, shell })),
          ...(order.model === undefined ? {} : { model: order.model }),
          ...effortOptionOf(order),
          ...(order.resumeSessionId === undefined ? {} : { resume: order.resumeSessionId }),
          env: {
            ...agentEnvironmentOf({ source: process.env }),
            ...shellEnvOf(shell),
            FORGE_STORY_REFERENCE: order.reference,
            FORGE_PHASE: order.phase,
            ...(order.baseUrl === undefined ? {} : { ANTHROPIC_BASE_URL: order.baseUrl }),
          },
        },
      })

      let forceClose: ReturnType<typeof setTimeout> | null = null
      started.onTerminate(() => {
        forceClose = setTimeout(() => conversation.close(), STOP_GRACE_MS)
        forceClose.unref()
        conversation.interrupt().catch(() => conversation.close())
      })
      const spoken = conversation[Symbol.asyncIterator]()
      let claudeSessionId: string | null = null
      while (claudeSessionId === null) {
        const step = await spoken.next()
        if (step.done === true) {
          started.channel.close()
          conversation.close()
          throw new SessionIdentifierMissingError(order.reference)
        }
        const message = step.value
        if ('session_id' in message && typeof message.session_id === 'string') {
          claudeSessionId = message.session_id
        }
        onEvent({
          name: `session.${message.type}`,
          payload: { reference: order.reference, phase: order.phase, claudeSessionId },
        })
      }

      try {
        started.adopt(claudeSessionId)
      } catch (error) {
        started.channel.close()
        conversation.close()
        throw error
      }
      const identifier = claudeSessionId
      const verifyGuardrails = (): string | null => {
        const changes = seal.changesSince(cwd)
        if (changes.length === 0) {
          return null
        }
        seal.markTampered(cwd, changes)
        conversation.close()
        return seal.tamperedReason(cwd)
      }
      void drain(spoken, { ...order, claudeSessionId: identifier }, onEvent, verifyGuardrails).finally(() => {
        if (forceClose !== null) {
          clearTimeout(forceClose)
        }
        live.close(identifier)
      })
      return { claudeSessionId }
    },
    abandon: (claudeSessionId) => {
      live.terminate(claudeSessionId)
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

export type ToolStep = {
  id: string
  name: string
  outcome: 'started' | 'ok' | 'failed'
}

function contentBlocksOf(message: unknown): readonly Record<string, unknown>[] {
  if (typeof message !== 'object' || message === null) {
    return []
  }
  const inner = (message as Record<string, unknown>).message
  if (typeof inner !== 'object' || inner === null) {
    return []
  }
  const content = (inner as Record<string, unknown>).content
  return Array.isArray(content)
    ? content.filter((block): block is Record<string, unknown> => typeof block === 'object' && block !== null)
    : []
}

export function toolsOf(message: unknown): readonly ToolStep[] {
  const steps: ToolStep[] = []
  for (const block of contentBlocksOf(message)) {
    if (block.type === 'tool_use' && typeof block.id === 'string') {
      steps.push({ id: block.id, name: typeof block.name === 'string' ? block.name : '', outcome: 'started' })
    }
    if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
      steps.push({ id: block.tool_use_id, name: '', outcome: block.is_error === true ? 'failed' : 'ok' })
    }
  }
  return steps
}

type ModelUsageLike = {
  contextWindow: number
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
}

function isModelUsageLike(value: unknown): value is ModelUsageLike {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.contextWindow === 'number' &&
    typeof candidate.inputTokens === 'number' &&
    typeof candidate.outputTokens === 'number'
  )
}

function primaryModelUsageOf(record: Record<string, unknown>): ModelUsageLike | null {
  const modelUsage = record.modelUsage
  if (typeof modelUsage !== 'object' || modelUsage === null) {
    return null
  }
  const entries = Object.values(modelUsage as Record<string, unknown>).filter(isModelUsageLike)
  return entries.reduce<ModelUsageLike | null>(
    (widest, entry) => (widest === null || entry.contextWindow > widest.contextWindow ? entry : widest),
    null,
  )
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
  const primary = primaryModelUsageOf(record)
  if (primary !== null) {
    collected.contextWindow = primary.contextWindow
    collected.contextTokens =
      primary.inputTokens +
      primary.outputTokens +
      (primary.cacheReadInputTokens ?? 0) +
      (primary.cacheCreationInputTokens ?? 0)
  }
  return collected
}

export function failureOf(message: unknown): string | null {
  if (typeof message !== 'object' || message === null) {
    return null
  }
  const record = message as Record<string, unknown>
  if (record.type === 'assistant' && typeof record.error === 'string' && record.error !== '') {
    return textOf(message) ?? record.error
  }
  const isFailedResult =
    record.type === 'result' &&
    (record.is_error === true || (typeof record.subtype === 'string' && record.subtype.startsWith('error')))
  if (!isFailedResult) {
    return null
  }
  if (typeof record.result === 'string' && record.result !== '') {
    return record.result
  }
  return typeof record.subtype === 'string' ? record.subtype : 'the session ended in error'
}

async function drain(
  spoken: AsyncIterator<{ type: string }>,
  order: LaunchOrder & { claudeSessionId: string },
  onEvent: SdkSessionRunnerInput['onEvent'],
  verifyGuardrails: () => string | null = () => null,
): Promise<void> {
  try {
    for await (const message of { [Symbol.asyncIterator]: () => spoken }) {
      const breach = message.type === 'result' ? verifyGuardrails() : null
      if (breach !== null) {
        onEvent({
          name: 'session.failed',
          payload: {
            reference: order.reference,
            phase: order.phase,
            claudeSessionId: order.claudeSessionId,
            message: breach,
          },
        })
        return
      }
      const failure = failureOf(message)
      onEvent({
        name: `session.${message.type}`,
        payload: {
          reference: order.reference,
          phase: order.phase,
          claudeSessionId: order.claudeSessionId,
          ...usageOf(message),
          ...(textOf(message) === null ? {} : { text: textOf(message) }),
          ...(toolsOf(message).length === 0 ? {} : { tools: toolsOf(message) }),
          ...(failure !== null && message.type === 'result' ? { isError: true } : {}),
        },
      })
      if (failure !== null && message.type !== 'result') {
        onEvent({
          name: 'session.failed',
          payload: {
            reference: order.reference,
            phase: order.phase,
            claudeSessionId: order.claudeSessionId,
            message: failure,
          },
        })
      }
    }
  } catch (error) {
    onEvent({
      name: 'session.failed',
      payload: {
        reference: order.reference,
        phase: order.phase,
        claudeSessionId: order.claudeSessionId,
        message: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

export type SdkSessionTalkerInput = {
  live: LiveSessions<SdkUserTurn>
  onEvent: (event: { name: string; payload: Record<string, unknown> }) => void
}

export function createSdkSessionTalker({ live, onEvent }: SdkSessionTalkerInput): SessionTalker {
  return {
    isLive: (claudeSessionId: string) => live.find(claudeSessionId) !== null,

    hangUp: (claudeSessionId: string) => {
      live.terminate(claudeSessionId)
    },

    say: (turn: SpokenTurn) => {
      const route = deliverTurn(turn, live)
      onEvent({
        name: 'session.turn_routed',
        payload: { reference: turn.reference, claudeSessionId: turn.claudeSessionId, route },
      })
      return Promise.resolve()
    },
  }
}
