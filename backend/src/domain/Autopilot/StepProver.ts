import { CHECKPOINT_SEQUENCE, type Checkpoint, type CheckpointName } from '../Checkpoint/Checkpoint.js'
import { EVIDENCE_SHAPE } from '../Evidence/EvidenceShape.js'
import { createCodeProofs } from './CodeProofs.js'
import { createReviewProof } from './ReviewProof.js'
import { AGENT_PROVEN_CHECKPOINTS, proofPathOf } from './StepBrief.js'
import { createProofTools, messageOf } from './StepProofSupport.js'
import type { ProofOrder, StepProver, StepProverInput } from './StepProofTypes.js'

export type { ProofOrder, ProofOutcome, ReviewerSession, StepProver, StepProverInput } from './StepProofTypes.js'

const PHASES_COVERING: Readonly<Record<CheckpointName, readonly string[]>> = {
  spec_done: ['spec', 'architecture'],
  arch_done: ['architecture'],
  tests_written: ['code'],
  build_done: ['code'],
  verified: ['gate', 'review'],
  reviewed: ['review'],
}

function isWaived(order: ProofOrder, name: CheckpointName): boolean {
  const phases = order.workflowPhases
  return phases !== undefined && !PHASES_COVERING[name].some((phase) => phases.includes(phase))
}

export function createStepProver(input: StepProverInput): StepProver {
  const { checkpoints } = input
  const tools = createProofTools(input)
  const { proveTestsWritten, proveBuildDone, proveVerified } = createCodeProofs(input, tools)
  const { proveReviewed } = createReviewProof(input, tools)

  function proveAgentProof(order: ProofOrder, name: CheckpointName): Checkpoint {
    return checkpoints.proveCheckpoint({
      storyId: order.storyId,
      name,
      evidencePath: proofPathOf(order.storyReference, name),
    })
  }

  function proveWaiver(order: ProofOrder, name: CheckpointName): Checkpoint {
    const sections = Object.fromEntries(
      EVIDENCE_SHAPE[name].map((section) => [
        section,
        [
          `Waived: the workflow of this card has no step that produces the ${name} checkpoint, so there is nothing to prove for ${section}.`,
          'The owner of the workflow chose to run it without that step, and the orchestrator records the waiver instead of asking for a file nobody was meant to write.',
        ],
      ]),
    )
    const path = tools.record(order, name, `Waiver of ${name} for ${order.storyReference}`, sections)
    return checkpoints.proveCheckpoint({ storyId: order.storyId, name, evidencePath: path }, { waived: true })
  }

  function proveOne(order: ProofOrder, name: CheckpointName): Checkpoint | string {
    if (isWaived(order, name)) {
      return proveWaiver(order, name)
    }
    if (AGENT_PROVEN_CHECKPOINTS.includes(name)) {
      return proveAgentProof(order, name)
    }
    if (name === 'tests_written') {
      return proveTestsWritten(order)
    }
    if (name === 'build_done') {
      return proveBuildDone(order)
    }
    return name === 'verified' ? proveVerified(order) : proveReviewed(order)
  }

  return {
    prove: (order) => {
      if (order.proves === null) {
        return { kind: 'ok', proven: [] }
      }
      const owed = CHECKPOINT_SEQUENCE.slice(0, CHECKPOINT_SEQUENCE.indexOf(order.proves) + 1)
      const proven: Checkpoint[] = []
      for (const name of owed) {
        if (checkpoints.definitionOfDone(order.storyId).find((step) => step.name === name)?.proven === true) {
          continue
        }
        try {
          const outcome = proveOne(order, name)
          if (typeof outcome === 'string') {
            return { kind: 'fail', reason: outcome }
          }
          proven.push(outcome)
        } catch (error) {
          return { kind: 'fail', reason: messageOf(error) }
        }
      }
      return { kind: 'ok', proven }
    },
  }
}
