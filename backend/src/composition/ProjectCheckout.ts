import { resolve } from 'node:path'
import type { StoryRepository } from '../domain/Story/StoryRepository.js'
import type { EvidenceReader } from '../domain/Evidence/EvidenceRead.js'
import { workingDirectoryOf } from '../domain/Dispatch/WorkingDirectory.js'
import { censusOfTree } from '../technical/Tamper/TestTreeCensus.js'
import { runRedReport } from '../technical/RedProof/RedProofRun.js'
import { createCommandTestRunner, runMutationCheck } from '../technical/Mutation/MutationRun.js'

export type CheckoutResolverInput = {
  stories: StoryRepository
  worktreePathOf: (storyId: number) => string | null
}

export type CheckoutResolver = {
  checkoutOfStory: (storyId: number) => string
  cwdForStory: (storyId: number) => string
  hasCheckout: (storyId: number) => boolean
}

export function createCheckoutResolver({ stories, worktreePathOf }: CheckoutResolverInput): CheckoutResolver {
  function checkoutOfStory(storyId: number): string {
    const projectId = stories.projectOfStory(storyId)
    const project = stories.listProjects().find((candidate) => candidate.id === projectId)
    return workingDirectoryOf(null, project?.checkoutPath, project?.name ?? String(projectId))
  }

  return {
    checkoutOfStory,
    cwdForStory: (storyId) => worktreePathOf(storyId) ?? checkoutOfStory(storyId),
    hasCheckout: (storyId) => {
      const projectId = stories.projectOfStory(storyId)
      const checkoutPath = stories.listProjects().find((candidate) => candidate.id === projectId)?.checkoutPath
      return checkoutPath !== null && checkoutPath !== undefined && checkoutPath !== ''
    },
  }
}

export type ProofGatesInput = {
  readEvidence: EvidenceReader
  testsDir: string
  redCommand: string
  mutationCommand: string
  mutationCommandOf?: (root: string) => string | null
  cwdForStory: (storyId: number) => string
}

function requiredRoot(root: string | undefined): string {
  if (root === undefined) {
    throw new RangeError("aucun dossier de travail n'est resolu pour cette preuve")
  }
  return root
}

export function createProofGates({
  readEvidence,
  testsDir,
  redCommand,
  mutationCommand,
  mutationCommandOf,
  cwdForStory,
}: ProofGatesInput) {
  return {
    takeCensus: (root?: string) => censusOfTree(resolve(requiredRoot(root), testsDir)),
    readEvidence,
    surveyRed: (root?: string) => runRedReport({ command: redCommand, cwd: requiredRoot(root) }),
    surveyMutations: (paths: readonly string[], root?: string) =>
      runMutationCheck({
        paths,
        root: requiredRoot(root),
        runTests: createCommandTestRunner({
          command: mutationCommandOf?.(requiredRoot(root)) ?? mutationCommand,
          cwd: requiredRoot(root),
        }),
      }),
    checkoutOf: cwdForStory,
  }
}
