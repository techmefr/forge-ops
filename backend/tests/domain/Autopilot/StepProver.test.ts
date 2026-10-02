import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createCheckpointRepository, type CheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository, type CriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createStepProver, type ProofOrder, type StepProver } from '../../../src/domain/Autopilot/StepProver.js'
import { createStoryInspection } from '../../../src/technical/Git/StoryInspection.js'
import { projectTestCommand } from '../../../src/technical/Gate/ProjectTestCommand.js'
import { writeEvidenceFile } from '../../../src/technical/Evidence/EvidenceFileWriter.js'
import { createEvidenceFileReader } from '../../../src/technical/Evidence/EvidenceFileReader.js'
import { createProofGates } from '../../../src/composition/ProjectCheckout.js'
import { proofPathOf } from '../../../src/domain/Autopilot/StepBrief.js'
import { EVIDENCE_SHAPE } from '../../../src/domain/Evidence/EvidenceShape.js'
import type { StepVerdict } from '../../../../contract/AutopilotContract.js'
import {
  commitFiles,
  createGitProject,
  git,
  MULTIPLY_SOURCE,
  MULTIPLY_TEST,
  UNRELATED_TEST,
  type GitProject,
} from '../../support/GitProject.js'

const PROSE = Array.from({ length: 50 }, (_unused, index) => `word${index}`).join(' ')

let project: GitProject
let db: Database.Database
let stories: StoryRepository
let checkpoints: CheckpointRepository
let criteria: CriterionRepository
let prover: StepProver
let storyId: number
let reference: string
let worktree: string
let baseSha: string

function agentProof(name: 'spec_done' | 'arch_done'): void {
  const sections = EVIDENCE_SHAPE[name].map((section) => `## ${section}`).join('\n')
  writeEvidenceFile(worktree, proofPathOf(reference, name), `${sections}\n\n${PROSE}\n`)
}

function orderFor(proves: ProofOrder['proves'], verdict: StepVerdict = { status: 'pass' }): ProofOrder {
  return { storyId, storyReference: reference, root: worktree, baseSha, stepKey: 'step', proves, verdict }
}

function provenNames(): string[] {
  return checkpoints
    .definitionOfDone(storyId)
    .filter((step) => step.proven)
    .map((step) => step.name)
}

function reviewVerdict(overrides: Partial<StepVerdict> = {}): StepVerdict {
  return {
    status: 'pass',
    lenses: {
      quality: { status: 'pass', findings: [{ severity: 'weak', path: 'src/multiply.js', statement: 'name the parameters' }] },
      security: { status: 'pass', findings: [] },
      accessibility: { status: 'pass', findings: [] },
    },
    criteria: [
      { reference: 'AC-1', status: 'met', evidence: 'test/multiply.test.js' },
      { reference: 'AC-2', status: 'met', evidence: 'src/multiply.js' },
    ],
    ...overrides,
  }
}

function finishBuild(): void {
  commitFiles(worktree, { 'test/multiply.test.js': MULTIPLY_TEST, 'src/multiply.js': MULTIPLY_SOURCE }, 'feat: multiply')
}

function proveUpToBuild(): void {
  agentProof('spec_done')
  agentProof('arch_done')
  finishBuild()
  expect(prover.prove(orderFor('build_done'))).toMatchObject({ kind: 'ok' })
}

beforeEach(() => {
  project = createGitProject()
  worktree = join(project.scratch, 'worktree')
  git(project.checkout, 'worktree', 'add', '-b', 'story/mul', worktree)
  baseSha = git(worktree, 'rev-parse', 'HEAD')
  db = openDatabase(':memory:')
  stories = createStoryRepository(db, { checkoutRoots: [project.scratch] })
  const projectId = stories.createProject({
    slug: 'sample',
    name: 'Sample',
    repositoryUrl: project.origin,
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  const epicId = stories.createEpic({ projectId, title: 'Maths', businessIntent: 'multiply numbers' }).id
  const story = stories.writeStory({
    epicId,
    title: 'Multiply two numbers for the customer',
    body: 'As a user I want to multiply two numbers\nso that I get a product.\n\nThe result is exact for integers.',
  })
  stories.writeTwin({ storyId: story.id, title: 'tests multiply', body: 'cases' })
  storyId = story.id
  reference = story.reference
  criteria = createCriterionRepository(db)
  criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'two numbers are multiplied' })
  criteria.declareCriterion({ storyId, reference: 'AC-2', statement: 'the product is exact' })
  const gates = createProofGates({
    readEvidence: createEvidenceFileReader({ root: worktree, evidenceRoot: '.claude/evidence' }),
    testsDir: 'test',
    redCommand: 'unused',
    mutationCommand: 'npm test',
    cwdForStory: () => worktree,
  })
  checkpoints = createCheckpointRepository(db, gates)
  const sessions = createAgentSessionRepository(db)
  sessions.registerSession({ storyId, claudeSessionId: 'review-1', phase: 'review', agentName: 'elrond', claudeCodeVersion: '2.1.224' })
  prover = createStepProver({
    checkpoints,
    criteria,
    inspection: createStoryInspection({ testCommandOf: (root) => projectTestCommand(root, undefined) }),
    writeEvidence: writeEvidenceFile,
    latestSessionOf: (id) => sessions.latestSessionOf(id),
  })
})

afterEach(() => {
  project.remove()
})

describe('what the agent proofs of the first steps need', () => {
  it('proves the spec and the plan from the evidence the agent wrote', () => {
    agentProof('spec_done')
    agentProof('arch_done')

    expect(prover.prove(orderFor('arch_done'))).toMatchObject({ kind: 'ok' })
    expect(provenNames()).toEqual(['spec_done', 'arch_done'])
  })

  it('refuses the spec when the agent wrote no evidence', () => {
    const outcome = prover.prove(orderFor('spec_done'))

    expect(outcome.kind).toBe('fail')
    expect(provenNames()).toEqual([])
  })
})

describe('the build step', () => {
  beforeEach(() => {
    agentProof('spec_done')
    agentProof('arch_done')
  })

  it('refuses a step that committed nothing', () => {
    const outcome = prover.prove(orderFor('build_done'))

    expect(outcome).toMatchObject({ kind: 'fail' })
    expect(outcome.kind === 'fail' && outcome.reason).toContain('no commit')
    expect(provenNames()).toEqual(['spec_done', 'arch_done'])
  })

  it('refuses work left uncommitted in the worktree', () => {
    finishBuild()
    writeFileSync(join(worktree, 'src', 'notes.js'), 'export const notes = 1\n')

    const outcome = prover.prove(orderFor('build_done'))

    expect(outcome.kind === 'fail' && outcome.reason).toContain('Uncommitted changes')
    expect(outcome.kind === 'fail' && outcome.reason).toContain('src/notes.js')
  })

  it('does not count the evidence folder as uncommitted work', () => {
    finishBuild()
    mkdirSync(join(worktree, '.claude', 'evidence'), { recursive: true })
    writeFileSync(join(worktree, '.claude', 'settings.local.json'), '{}\n')

    expect(prover.prove(orderFor('build_done'))).toMatchObject({ kind: 'ok' })
  })

  it('refuses tests that pass without the production code, however sure the agent is', () => {
    commitFiles(worktree, { 'test/unrelated.test.js': UNRELATED_TEST, 'src/multiply.js': MULTIPLY_SOURCE }, 'feat: multiply')

    const outcome = prover.prove(orderFor('build_done', { status: 'pass', reason: 'all green, trust me' }))

    expect(outcome.kind === 'fail' && outcome.reason).toContain('also pass when the production code')
    expect(provenNames()).toEqual(['spec_done', 'arch_done'])
  })

  it('refuses a story whose suite is red, with the output of the run', () => {
    commitFiles(
      worktree,
      {
        'test/multiply.test.js': MULTIPLY_TEST,
        'src/multiply.js': 'export function multiply(left, right) {\n  return left + right\n}\n',
      },
      'feat: multiply',
    )

    const outcome = prover.prove(orderFor('build_done'))

    expect(outcome.kind === 'fail' && outcome.reason).toContain('not green')
    expect(outcome.kind === 'fail' && outcome.reason).toContain('multiplies two numbers')
  })

  it('refuses a story that changes tests only, since red cannot be observed', () => {
    commitFiles(worktree, { 'test/unrelated.test.js': UNRELATED_TEST }, 'test: add')

    const outcome = prover.prove(orderFor('build_done'))

    expect(outcome.kind === 'fail' && outcome.reason).toContain('No production code changed')
  })

  it('proves tests_written then build_done with proofs the orchestrator wrote', () => {
    finishBuild()

    const outcome = prover.prove(orderFor('build_done'))

    expect(outcome).toMatchObject({ kind: 'ok' })
    expect(provenNames()).toEqual(['spec_done', 'arch_done', 'tests_written', 'build_done'])
    const written = checkpoints.definitionOfDone(storyId).find((step) => step.name === 'tests_written')
    expect(written?.evidencePath).toBe(`.claude/evidence/${reference}/tests_written.checked.md`)
    const proof = readFileSync(join(worktree, written?.evidencePath ?? ''), 'utf-8')
    expect(proof).toContain('Red run without the production code, exit 1')
    expect(proof).toContain('Green run with the production code, exit 0')
    expect(proof).toContain('src/multiply.js')
  })

  it('leaves no scratch worktree behind after the red run', () => {
    finishBuild()

    prover.prove(orderFor('build_done'))

    expect(git(project.checkout, 'worktree', 'list')).not.toContain('forge-red-')
  })

  it('proves nothing for a step that owes no checkpoint', () => {
    expect(prover.prove(orderFor(null))).toEqual({ kind: 'ok', proven: [] })
    expect(provenNames()).toEqual([])
  })
})

describe('the review step', () => {
  beforeEach(() => {
    proveUpToBuild()
  })

  it('proves verified, the three lenses, the criteria and reviewed from the reviewer verdict', () => {
    const outcome = prover.prove(orderFor('reviewed', reviewVerdict()))

    expect(outcome).toMatchObject({ kind: 'ok' })
    expect(provenNames()).toEqual(['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified', 'reviewed'])
    expect(checkpoints.reviewCascade(storyId).map((pass) => pass.state)).toEqual(['passed', 'passed', 'passed'])
    expect(criteria.listCriteria(storyId).every((criterion) => criterion.satisfied && criterion.evidencePath !== null)).toBe(true)
    expect(checkpoints.listUnresolvedFindings(storyId)).toHaveLength(1)
  })

  it('refuses a verdict that leaves a lens unanswered', () => {
    const verdict = reviewVerdict()

    const outcome = prover.prove(orderFor('reviewed', { ...verdict, lenses: { quality: verdict.lenses?.quality ?? { status: 'pass' } } }))

    expect(outcome.kind === 'fail' && outcome.reason).toContain('no result for the security lens')
    expect(provenNames()).toContain('verified')
    expect(provenNames()).not.toContain('reviewed')
  })

  it('refuses a lens that passed with a strong finding', () => {
    const verdict = reviewVerdict()

    const outcome = prover.prove(
      orderFor('reviewed', {
        ...verdict,
        lenses: {
          ...verdict.lenses,
          security: { status: 'pass', findings: [{ severity: 'strong', path: 'src/multiply.js', statement: 'unchecked input' }] },
        },
      }),
    )

    expect(outcome.kind === 'fail' && outcome.reason).toContain('security lens did not pass')
    expect(outcome.kind === 'fail' && outcome.reason).toContain('unchecked input')
    expect(checkpoints.reviewCascade(storyId).map((pass) => pass.state)).toEqual(['pending', 'pending', 'pending'])
  })

  it('refuses a criterion that is not answered or cites a file the story never touched', () => {
    const outcome = prover.prove(
      orderFor('reviewed', reviewVerdict({ criteria: [{ reference: 'AC-1', status: 'met', evidence: 'README.md' }] })),
    )

    expect(outcome.kind === 'fail' && outcome.reason).toContain('criterion AC-1 cites no file changed by this story')
    expect(outcome.kind === 'fail' && outcome.reason).toContain('criterion AC-2 is not answered as met')
    expect(criteria.listCriteria(storyId).some((criterion) => criterion.satisfied)).toBe(false)
  })

  it('refuses verification when the reviewer left the suite red', () => {
    commitFiles(worktree, { 'src/multiply.js': 'export function multiply(left, right) {\n  return 0\n}\n' }, 'fix: review')

    const outcome = prover.prove(orderFor('reviewed', reviewVerdict()))

    expect(outcome.kind === 'fail' && outcome.reason).toContain('not green after the review')
    expect(provenNames()).not.toContain('verified')
  })

  it('catches a reviewer who rewrote the tests after they were proven', () => {
    commitFiles(worktree, { 'test/multiply.test.js': `${MULTIPLY_TEST}\ntest.skip('later', () => undefined)\n` }, 'test: skip')

    const outcome = prover.prove(orderFor('reviewed', reviewVerdict()))

    expect(outcome.kind === 'fail' && outcome.reason).toContain('The test suite changed since it was written')
    expect(provenNames()).not.toContain('reviewed')
  })

  it('accepts the corrected verdict on a later attempt', () => {
    const verdict = reviewVerdict()
    const partial = prover.prove(
      orderFor('reviewed', { ...verdict, lenses: { quality: verdict.lenses?.quality ?? { status: 'pass' } } }),
    )
    expect(partial.kind).toBe('fail')

    const second = prover.prove(orderFor('reviewed', verdict))

    expect(second).toMatchObject({ kind: 'ok' })
    expect(provenNames()).toContain('reviewed')
  })
})
