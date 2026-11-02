import { createAutopilotAutoView } from './AutopilotAutoView.js'
import { createAutopilotCardState } from './AutopilotCardState.js'
import { createAutopilotEvaluation } from './AutopilotEvaluation.js'
import type { AutopilotConductor, AutopilotConductorInput } from './AutopilotInput.js'
import { createAutopilotLauncher } from './AutopilotLauncher.js'
import { createAutopilotTransitions } from './AutopilotTransitions.js'
import { createStepVerifier } from './StepVerifier.js'

export type { AutopilotConductor, AutopilotConductorInput } from './AutopilotInput.js'
export { WAITING_BUDGET_REASON } from './AutopilotHandling.js'
export { NEEDS_CRITERIA_REASON, type StepOutcome } from './StepVerifier.js'

export function createAutopilotConductor(input: AutopilotConductorInput): AutopilotConductor {
  const { autopilot, sessions, forgeCards } = input
  const verifier = createStepVerifier(input)
  const state = createAutopilotCardState(input)
  const launcher = createAutopilotLauncher(input, state)
  const transitions = createAutopilotTransitions(input, verifier, state)
  const { evaluate } = createAutopilotEvaluation(input, verifier, state, transitions)
  const { autoViewOf } = createAutopilotAutoView(input, launcher)
  const { runPending } = transitions
  let queue: Promise<void> = Promise.resolve()

  function enqueue(work: () => Promise<void>): Promise<void> {
    const next = queue.then(work).catch(() => undefined)
    queue = next
    return next
  }

  async function turnEnded(claudeSessionId: string): Promise<void> {
    const session = sessions.findByClaudeSessionId(claudeSessionId)
    const card = session === null ? null : forgeCards.openCardOfStory(session.storyId)
    if (card !== null) {
      await evaluate(card.id)
    }
  }

  async function tickAll(): Promise<void> {
    for (const record of autopilot.listPending()) {
      await runPending(record.forgeCardId)
    }
    await launcher.launchBacklog()
    await launcher.launchIdle()
  }

  function resume(forgeCardId: number): Promise<boolean> {
    const record = autopilot.cardOf(forgeCardId)
    if (record.state !== 'red' || record.pending === null) {
      return Promise.resolve(false)
    }
    return enqueue(async () => {
      state.patch(forgeCardId, { state: null, reason: null })
      await runPending(forgeCardId)
    }).then(() => true)
  }

  function suspend(forgeCardId: number): () => void {
    const previous = autopilot.cardOf(forgeCardId)
    autopilot.resetCard(forgeCardId)
    return () => {
      if (previous.stepKey !== '') {
        autopilot.patchCard(forgeCardId, previous)
      }
    }
  }

  return {
    turnEnded: (claudeSessionId) => enqueue(() => turnEnded(claudeSessionId)),
    tick: () => enqueue(tickAll),
    resume,
    reset: (forgeCardId) => {
      autopilot.resetCard(forgeCardId)
    },
    suspend,
    autoViewOf,
    idle: () => queue,
  }
}
