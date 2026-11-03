import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { ForgeCardRepository } from '../ForgeCard/ForgeCardRepository.js'
import type { Dispatched, DispatchOrder, SessionRunner } from './Dispatch.js'
import type { Admission } from './DispatchAdmission.js'
import type { ResolvedDispatch } from './DispatchContract.js'
import type { CardClaim } from './DispatchGuards.js'
import type { BuiltPrompt } from './DispatchPrompt.js'
import type { createRateBucket } from './DispatchRate.js'

type LauncherInput = {
  runner: SessionRunner
  sessions: AgentSessionRepository
  checkpoints: CheckpointRepository
  forgeCards: ForgeCardRepository
  bucket: ReturnType<typeof createRateBucket>
  claudeCodeVersion: string
  prepareWorkspace?: (target: { storyId: number; forgeCardId: number | null }) => void
}

export type LaunchRequest = {
  order: DispatchOrder
  resolved: ResolvedDispatch
  claim: CardClaim
  built: BuiltPrompt
  admission: Admission
}

function dispatchedOf({ order, resolved, built, admission }: LaunchRequest, claudeSessionId: string): Dispatched {
  return {
    claudeSessionId,
    storyId: order.storyId,
    phase: order.phase,
    ...(order.lens === undefined ? {} : { lens: order.lens }),
    agentName: resolved.agentName,
    prompt: built.prompt,
    ...(built.model === undefined ? {} : { model: built.model }),
    ...(admission.decision.baseUrl === undefined ? {} : { baseUrl: admission.decision.baseUrl }),
    ...built.stepSettings,
  }
}

export function createDispatchLauncher({
  runner,
  sessions,
  checkpoints,
  forgeCards,
  bucket,
  claudeCodeVersion,
  prepareWorkspace,
}: LauncherInput) {
  async function startSession({ order, resolved, claim, built, admission }: LaunchRequest): Promise<string> {
    const { forgeCard } = claim
    const { decision, takenAt } = admission
    const resumeSessionId = forgeCard?.claudeSessionId ?? undefined
    try {
      prepareWorkspace?.({ storyId: order.storyId, forgeCardId: forgeCard?.id ?? null })
      const launched = await runner.launch({
        storyId: order.storyId,
        reference: built.reference,
        phase: order.phase,
        agentName: resolved.agentName,
        prompt: built.prompt,
        ...(built.model === undefined ? {} : { model: built.model }),
        ...(decision.baseUrl === undefined ? {} : { baseUrl: decision.baseUrl }),
        ...built.stepSettings,
        ...(forgeCard === null ? {} : { forgeCardId: forgeCard.id }),
        ...(resumeSessionId === undefined ? {} : { resumeSessionId }),
      })
      return launched.claudeSessionId
    } catch (error) {
      bucket.refund(takenAt)
      throw error
    }
  }

  function register(request: LaunchRequest, claudeSessionId: string): void {
    const { order, resolved, claim, admission } = request
    try {
      sessions.registerSession({
        storyId: order.storyId,
        claudeSessionId,
        phase: order.phase,
        agentName: resolved.agentName,
        claudeCodeVersion,
      })
      if (claim.forgeCard !== null) {
        forgeCards.recordDispatch(claim.forgeCard.id, { claudeSessionId, phase: order.phase })
      }
    } catch (error) {
      runner.abandon?.(claudeSessionId)
      bucket.refund(admission.takenAt)
      throw error
    }
  }

  async function launch(request: LaunchRequest): Promise<Dispatched> {
    const { order, claim } = request
    for (const waitingSessionId of claim.waitingOnCard) {
      runner.abandon?.(waitingSessionId)
      sessions.closeSession(waitingSessionId, { exitCode: 0 })
    }
    const claudeSessionId = await startSession(request)
    register(request, claudeSessionId)
    if (order.lens !== undefined) {
      checkpoints.startLens(order.storyId, order.lens, claudeSessionId)
    }
    return dispatchedOf(request, claudeSessionId)
  }

  return { launch }
}
