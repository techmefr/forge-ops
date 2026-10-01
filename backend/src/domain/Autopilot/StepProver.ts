import type { StepVerdict } from '../../../../contract/AutopilotContract.js'
import {
  CHECKPOINT_SEQUENCE,
  REVIEW_LENS_SEQUENCE,
  type Checkpoint,
  type CheckpointName,
  type ReviewLens,
} from '../Checkpoint/Checkpoint.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import { checkedProofPathOf, criterionProofPathOf, proofDocument, quoted } from './ProofDocument.js'
import { AGENT_PROVEN_CHECKPOINTS, proofPathOf } from './StepBrief.js'
import { isProductionCode, isTestPath, type ChangedFile, type StoryInspection } from './StoryInspection.js'

export type ProofOrder = {
  storyId: number
  storyReference: string
  root: string
  baseSha: string
  stepKey: string
  proves: CheckpointName | null
  verdict: StepVerdict
}

export type ProofOutcome = { kind: 'ok'; proven: readonly Checkpoint[] } | { kind: 'fail'; reason: string }

export type StepProver = {
  prove: (order: ProofOrder) => ProofOutcome
}

export type ReviewerSession = {
  claudeSessionId: string
}

export type StepProverInput = {
  checkpoints: Pick<
    CheckpointRepository,
    'definitionOfDone' | 'proveCheckpoint' | 'reviewCascade' | 'startLens' | 'passLens' | 'recordFinding'
  >
  criteria: Pick<CriterionRepository, 'listCriteria' | 'satisfyCriterion'>
  inspection: StoryInspection
  writeEvidence: (root: string, path: string, content: string) => void
  latestSessionOf: (storyId: number) => ReviewerSession | null
}

const SHORT_SHA = 7

type Facts = {
  changed: readonly ChangedFile[]
  tests: readonly ChangedFile[]
  production: readonly ChangedFile[]
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function list(files: readonly ChangedFile[]): readonly string[] {
  return files.map((file) => `- ${file.status} ${file.path}`)
}

export function createStepProver({
  checkpoints,
  criteria,
  inspection,
  writeEvidence,
  latestSessionOf,
}: StepProverInput): StepProver {
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

  function proveAgentProof(order: ProofOrder, name: CheckpointName): Checkpoint {
    return checkpoints.proveCheckpoint({
      storyId: order.storyId,
      name,
      evidencePath: proofPathOf(order.storyReference, name),
    })
  }

  function proveTestsWritten(order: ProofOrder): Checkpoint | string {
    const facts = factsOf(order)
    if (typeof facts === 'string') {
      return facts
    }
    if (facts.tests.length === 0) {
      return 'No test file was added or changed on the story branch: write the tests of the story and commit them'
    }
    if (facts.production.length === 0) {
      return 'No production code changed on the story branch, so the tests cannot be shown to fail without it'
    }
    const green = inspection.runTests(order.root)
    if (green.exitCode !== 0) {
      return `The test suite is not green at the end of the step (exit ${green.exitCode}). Output:\n${green.output}`
    }
    const red = inspection.runTestsWithout(order.root, order.baseSha, facts.production)
    if (red.exitCode === 0) {
      return 'The tests also pass when the production code of the story is reverted, so they prove nothing about it: write tests that fail without the change'
    }
    const path = record(order, 'tests_written', `Tests of ${order.storyReference}`, {
      cases: [
        'Test files added or changed by the story:',
        ...list(facts.tests),
        'Production files reverted in the scratch copy to observe the red run:',
        ...list(facts.production),
      ],
      output: [
        `Red run without the production code, exit ${red.exitCode}:`,
        ...quoted(red.output),
        `Green run with the production code, exit ${green.exitCode}:`,
        ...quoted(green.output),
      ],
    })
    return checkpoints.proveCheckpoint(
      { storyId: order.storyId, name: 'tests_written', evidencePath: path },
      { redObservedByOrchestrator: true },
    )
  }

  function proveBuildDone(order: ProofOrder): Checkpoint | string {
    const facts = factsOf(order)
    if (typeof facts === 'string') {
      return facts
    }
    const green = inspection.runTests(order.root)
    if (green.exitCode !== 0) {
      return `The test suite is not green at the end of the step (exit ${green.exitCode}). Output:\n${green.output}`
    }
    const path = record(order, 'build_done', `Build of ${order.storyReference}`, {
      built: [
        `Commits on the story branch beyond ${order.baseSha.slice(0, SHORT_SHA)}:`,
        ...inspection.commitLog(order.root, order.baseSha).map((line) => `- ${line}`),
        'Files changed by the story:',
        ...list(facts.changed),
      ],
      output: [`Test suite at HEAD, exit ${green.exitCode}:`, ...quoted(green.output)],
    })
    return checkpoints.proveCheckpoint(
      { storyId: order.storyId, name: 'build_done', evidencePath: path },
      { touchedPaths: facts.production.filter((file) => file.status !== 'deleted').map((file) => file.path) },
    )
  }

  function proveVerified(order: ProofOrder): Checkpoint | string {
    const facts = factsOf(order)
    if (typeof facts === 'string') {
      return facts
    }
    const green = inspection.runTests(order.root)
    if (green.exitCode !== 0) {
      return `The test suite is not green after the review (exit ${green.exitCode}). Output:\n${green.output}`
    }
    const path = record(order, 'verified', `Verification of ${order.storyReference}`, {
      walked: [
        `Working tree clean, ${inspection.commitsAhead(order.root, order.baseSha)} commit(s) beyond ${order.baseSha.slice(0, SHORT_SHA)}, HEAD ${inspection.headSha(order.root).slice(0, SHORT_SHA)}.`,
        'The project test command was run again on the final state of the story branch.',
      ],
      observed: [`Test suite at HEAD, exit ${green.exitCode}:`, ...quoted(green.output)],
    })
    return checkpoints.proveCheckpoint({ storyId: order.storyId, name: 'verified', evidencePath: path })
  }

  function lensProblems(order: ProofOrder): readonly string[] {
    const problems: string[] = []
    const cascade = checkpoints.reviewCascade(order.storyId)
    for (const lens of REVIEW_LENS_SEQUENCE) {
      if (cascade.find((pass) => pass.lens === lens)?.state === 'passed') {
        continue
      }
      const reading = order.verdict.lenses?.[lens]
      if (reading === undefined) {
        problems.push(`the verdict carries no result for the ${lens} lens`)
        continue
      }
      const strong = (reading.findings ?? []).filter((finding) => finding.severity === 'strong')
      if (reading.status !== 'pass' || strong.length > 0) {
        const named = strong.map((finding) => `${finding.path}: ${finding.statement}`)
        problems.push(`the ${lens} lens did not pass${named.length === 0 ? '' : ` (${named.join('; ')})`}`)
      }
    }
    return problems
  }

  function criterionProblems(order: ProofOrder, changed: readonly ChangedFile[]): readonly string[] {
    const touched = new Set(changed.map((file) => file.path))
    const problems: string[] = []
    for (const criterion of criteria.listCriteria(order.storyId).filter((candidate) => !candidate.satisfied)) {
      const answer = order.verdict.criteria?.find((candidate) => candidate.reference === criterion.reference)
      if (answer === undefined || answer.status !== 'met') {
        problems.push(`criterion ${criterion.reference} is not answered as met`)
      } else if (answer.evidence === undefined || !touched.has(answer.evidence)) {
        problems.push(`criterion ${criterion.reference} cites no file changed by this story as evidence`)
      }
    }
    return problems
  }

  function settleReview(order: ProofOrder, session: ReviewerSession, changed: readonly ChangedFile[]): void {
    const cascade = checkpoints.reviewCascade(order.storyId)
    for (const lens of REVIEW_LENS_SEQUENCE) {
      if (cascade.find((pass) => pass.lens === lens)?.state === 'passed') {
        continue
      }
      checkpoints.startLens(order.storyId, lens, session.claudeSessionId)
      for (const finding of order.verdict.lenses?.[lens]?.findings ?? []) {
        checkpoints.recordFinding({
          storyId: order.storyId,
          claudeSessionId: session.claudeSessionId,
          lens,
          severity: finding.severity,
          path: finding.path,
          statement: finding.statement,
        })
      }
      checkpoints.passLens(order.storyId, lens)
    }
    const head = inspection.headSha(order.root).slice(0, SHORT_SHA)
    for (const criterion of criteria.listCriteria(order.storyId).filter((candidate) => !candidate.satisfied)) {
      const evidence = order.verdict.criteria?.find((candidate) => candidate.reference === criterion.reference)?.evidence ?? ''
      const path = criterionProofPathOf(order.storyReference, criterion.reference)
      writeEvidence(
        order.root,
        path,
        proofDocument(`Criterion ${criterion.reference} of ${order.storyReference}`, {
          claim: [`Criterion: ${criterion.statement}`, `The reviewer answered it as met and cited ${evidence}, a file changed by this story.`],
          check: [
            `The cited file is part of the diff of the story branch at HEAD ${head}, and ${changed.length} file(s) changed in total.`,
          ],
        }),
      )
      criteria.satisfyCriterion(criterion.id, path)
    }
  }

  function proveReviewed(order: ProofOrder): Checkpoint | string {
    const facts = factsOf(order)
    if (typeof facts === 'string') {
      return facts
    }
    const session = latestSessionOf(order.storyId)
    if (session === null) {
      return 'No agent session is recorded for this story, so no review can be attributed'
    }
    const problems = [...lensProblems(order), ...criterionProblems(order, facts.changed)]
    if (problems.length > 0) {
      return `The review cannot be recorded: ${problems.join('; ')}. Answer every lens and every declared criterion in the verdict, and fix what failed.`
    }
    settleReview(order, session, facts.changed)
    const lensLines = REVIEW_LENS_SEQUENCE.map((lens: ReviewLens) => {
      const findings = order.verdict.lenses?.[lens]?.findings ?? []
      return `- ${lens}: pass, ${findings.length} finding(s) recorded, none of them strong`
    })
    const path = record(order, 'reviewed', `Review of ${order.storyReference}`, {
      findings: [
        'Lens results given by the reviewer and accepted by the orchestrator, which refuses a strong finding or a missing lens:',
        ...lensLines,
        `Every declared criterion was answered as met with a file changed by the story, at HEAD ${inspection.headSha(order.root).slice(0, SHORT_SHA)}.`,
      ],
    })
    return checkpoints.proveCheckpoint({ storyId: order.storyId, name: 'reviewed', evidencePath: path })
  }

  function proveOne(order: ProofOrder, name: CheckpointName): Checkpoint | string {
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
