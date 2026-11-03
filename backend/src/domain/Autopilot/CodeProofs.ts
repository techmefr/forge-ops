import type { Checkpoint } from '../Checkpoint/Checkpoint.js'
import { quoted } from './ProofDocument.js'
import { list, SHORT_SHA, type ProofTools } from './StepProofSupport.js'
import type { ProofOrder, StepProverInput } from './StepProofTypes.js'

function createTestsWrittenProof(
  { checkpoints, inspection }: Pick<StepProverInput, 'checkpoints' | 'inspection'>,
  { factsOf, record }: ProofTools,
) {
  return function proveTestsWritten(order: ProofOrder): Checkpoint | string {
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
}

export function createCodeProofs(
  { checkpoints, inspection }: Pick<StepProverInput, 'checkpoints' | 'inspection'>,
  { factsOf, record }: ProofTools,
) {
  const proveTestsWritten = createTestsWrittenProof({ checkpoints, inspection }, { factsOf, record })

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

  return { proveTestsWritten, proveBuildDone, proveVerified }
}
