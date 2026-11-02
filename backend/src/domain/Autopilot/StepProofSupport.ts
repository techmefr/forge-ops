import type { CheckpointName } from '../Checkpoint/Checkpoint.js'
import { checkedProofPathOf, proofDocument } from './ProofDocument.js'
import type { ProofOrder, StepProverInput } from './StepProofTypes.js'
import { isProductionCode, isTestPath, type ChangedFile } from './StoryInspection.js'

export const SHORT_SHA = 7

export type Facts = {
  changed: readonly ChangedFile[]
  tests: readonly ChangedFile[]
  production: readonly ChangedFile[]
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function list(files: readonly ChangedFile[]): readonly string[] {
  return files.map((file) => `- ${file.status} ${file.path}`)
}

export function createProofTools({ inspection, writeEvidence }: Pick<StepProverInput, 'inspection' | 'writeEvidence'>) {
  function factsOf(order: ProofOrder): Facts | string {
    if (inspection.commitsAhead(order.root, order.baseSha) === 0) {
      return `The story branch has no commit beyond ${order.baseSha.slice(0, SHORT_SHA)}: commit your work on it before ending the step`
    }
    const dirty = inspection.uncommittedPaths(order.root)
    if (dirty.length > 0) {
      return `Uncommitted changes remain (${dirty.slice(0, 5).join(', ')}): commit them on the story branch before ending the step`
    }
    const changed = inspection.changedFiles(order.root, order.baseSha)
    return {
      changed,
      tests: changed.filter((file) => file.status !== 'deleted' && isTestPath(file.path)),
      production: changed.filter((file) => isProductionCode(file.path)),
    }
  }

  function record(order: ProofOrder, name: CheckpointName, title: string, sections: Record<string, readonly string[]>): string {
    const path = checkedProofPathOf(order.storyReference, name)
    writeEvidence(order.root, path, proofDocument(title, sections))
    return path
  }

  return { factsOf, record }
}

export type ProofTools = ReturnType<typeof createProofTools>
