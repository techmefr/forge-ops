import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createCheckpointRepository, type CheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { createAgentSessionRepository, type AgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createStepEntry } from '../../../src/domain/Dispatch/StepEntry.js'
import { createDispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import { createWorkflowColumnRepository } from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import { createForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import { createForgeBoardRepository, type ForgeBoardRepository } from '../../../src/domain/ForgeCard/ForgeBoardRepository.js'
import { createForgeCardMover } from '../../../src/domain/ForgeCard/ForgeCardMover.js'
import { createForgeCardCloser, type ForgeCardClosed } from '../../../src/domain/ForgeCard/ForgeCardCloser.js'
import { createAutopilotConductor, type AutopilotConductor } from '../../../src/domain/Autopilot/AutopilotConductor.js'
import { createAutopilotRepository } from '../../../src/domain/Autopilot/AutopilotRepository.js'
import { createStepProver } from '../../../src/domain/Autopilot/StepProver.js'
import { proofPathOf, verdictPathOf } from '../../../src/domain/Autopilot/StepBrief.js'
import { EVIDENCE_SHAPE } from '../../../src/domain/Evidence/EvidenceShape.js'
import { cleanUpAfterMerge } from '../../../src/domain/Deployment/MergeCleanup.js'
import { createWorktreeRepository, type WorktreeRepository } from '../../../src/domain/Worktree/WorktreeRepository.js'
import { createGitWorktree } from '../../../src/technical/Git/GitWorktree.js'
import { createStoryPublisher } from '../../../src/technical/Git/StoryPublication.js'
import { createStoryInspection } from '../../../src/technical/Git/StoryInspection.js'
import { projectTestCommand } from '../../../src/technical/Gate/ProjectTestCommand.js'
import { writeEvidenceFile } from '../../../src/technical/Evidence/EvidenceFileWriter.js'
import { createEvidenceFileReader } from '../../../src/technical/Evidence/EvidenceFileReader.js'
import { createStoryWorkspace } from '../../../src/composition/StoryWorkspace.js'
import { createProofGates } from '../../../src/composition/ProjectCheckout.js'
import type { WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'
import type { ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import {
  commitFiles,
  createGitProject,
  git,
  MULTIPLY_SOURCE,
  MULTIPLY_TEST,
  type GitProject,
} from '../../support/GitProject.js'

const AGENT_STEP: WorkflowColumnDraft = {
  label: 'Spec',
  colour: 'acc',
  provider: 'claude',
  model: 'claude-sonnet-5',
  effort: 'high',
  agentName: '',
  command: '',
  preprompt: '',
  autoStart: true,
}

const DEFAULT_TEMPLATE = ['Spec', 'Plan', 'Build', 'Review', 'Ship']

const BODY = [
  'As a user, I want to multiply two numbers',
  'so that I get their product without a calculator.',
  '',
  'The result is exact for integers and the helper is exported from src/multiply.js.',
].join('\n')

const PROSE = Array.from({ length: 50 }, (_unused, index) => `word${index}`).join(' ')

const PASSING_REVIEW = {
  status: 'pass',
  reason: 'read the whole diff',
  lenses: {
    quality: { status: 'pass', findings: [] },
    security: { status: 'pass', findings: [] },
    accessibility: { status: 'pass', findings: [] },
  },
  criteria: [
    { reference: 'AC-1', status: 'met', evidence: 'test/multiply.test.js' },
    { reference: 'AC-2', status: 'met', evidence: 'src/multiply.js' },
  ],
}

let project: GitProject
let db: Database.Database
let stories: StoryRepository
let sessions: AgentSessionRepository
let board: ForgeBoardRepository
let worktrees: WorktreeRepository
let conductor: AutopilotConductor
let checkpoints: CheckpointRepository
let launched: string[]
let closedWith: ForgeCardClosed | null
let projectId: number
let epicId: number

function boot(): void {
  project = createGitProject()
  db = openDatabase(':memory:')
  launched = []
  closedWith = null
  const forgeCards = createForgeCardRepository(db)
  stories = createStoryRepository(db, {
    onBacklog: (story) => forgeCards.attachCardToStory(story.id),
    checkoutRoots: [project.scratch],
  })
  sessions = createAgentSessionRepository(db)
  const columns = createWorkflowColumnRepository(db)
  const autopilot = createAutopilotRepository(db)
  projectId = stories.createProject({
    slug: 'sample',
    name: 'Sample',
    repositoryUrl: project.origin,
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  stories.setCheckoutPath(projectId, project.checkout)
  epicId = stories.createEpic({ projectId, title: 'Maths', businessIntent: 'multiply numbers' }).id
  for (const label of DEFAULT_TEMPLATE) {
    columns.create(projectId, { ...AGENT_STEP, label })
  }
  worktrees = createWorktreeRepository(db, {
    stories,
    git: createGitWorktree({ repositoryRoot: project.checkout }),
    root: join(project.scratch, 'worktrees'),
    checkoutOf: () => project.checkout,
    isPortFree: () => true,
  })
  const cwdOf = (storyId: number): string => worktrees.findForStory(storyId)?.path ?? project.checkout
  const readEvidence = createEvidenceFileReader({ root: project.checkout, evidenceRoot: '.claude/evidence' })
  checkpoints = createCheckpointRepository(
    db,
    createProofGates({
      readEvidence,
      testsDir: 'test',
      redCommand: 'unused',
      mutationCommand: 'npm test',
      cwdForStory: cwdOf,
    }),
  )
  const criteria = createCriterionRepository(db)
  const foremerge = createForemergeRepository(db, { stories })
  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints,
    criteria,
    sessions,
    budget: createBudgetRepository(db),
    foremerge,
    runner: {
      launch: async (order) => {
        launched.push(order.phase)
        return { claudeSessionId: `session-${launched.length}` }
      },
    },
    concurrencyCap: 5,
    claudeCodeVersion: '2.1.224',
    prepareWorkspace: createStoryWorkspace({ hasCheckout: () => true, worktrees }),
  })
  const holder: { conductor: AutopilotConductor | null } = { conductor: null }
  board = createForgeBoardRepository(db, {
    forgeCards,
    columns,
    autoOf: (view) => holder.conductor?.autoViewOf(view) ?? null,
  })
  const realCloser = createForgeCardCloser({
    board,
    forgeCards,
    stories,
    columns,
    checkpoints,
    criteria,
    cleanUpAfterMerge: (storyId) =>
      cleanUpAfterMerge({
        storyId,
        releaseScope: foremerge.release,
        closeWorktree: (target) => worktrees.close(target, { deleteBranch: true }),
      }),
    publishStory: (storyId) => {
      const worktree = worktrees.findForStory(storyId)
      if (worktree === null) {
        return null
      }
      const story = stories.findStory(storyId)
      return createStoryPublisher().publish({
        worktreePath: worktree.path,
        branch: worktree.branch,
        baseBranch: 'main',
        title: story.title,
        body: story.reference,
        autoMerge: autopilot.settingsOf(projectId).autoMerge,
      })
    },
  })
  conductor = createAutopilotConductor({
    autopilot,
    board,
    forgeCards,
    stories,
    columns,
    sessions,
    criteria,
    checkpoints,
    readEvidence: (path, root) => readEvidence(path, root ?? project.checkout),
    cwdOf,
    clearVerdict: (root, path) => rmSync(join(root, path), { force: true }),
    mover: createForgeCardMover({
      board,
      forgeCards,
      stories,
      columns,
      enterStep: createStepEntry({ dispatcher, columns }),
      launchStep: (entry) => dispatcher.dispatch(entry),
    }),
    closer: {
      close: (forgeCardId) => {
        closedWith = realCloser.close(forgeCardId)
        return closedWith
      },
    },
    lastAgentMessage: () => null,
    prover: createStepProver({
      checkpoints,
      criteria,
      inspection: createStoryInspection({ testCommandOf: (root) => projectTestCommand(root, undefined) }),
      writeEvidence: writeEvidenceFile,
      latestSessionOf: (storyId) => sessions.latestSessionOf(storyId),
    }),
    baseShaOf: (storyId) => worktrees.findForStory(storyId)?.baseSha ?? null,
  })
  holder.conductor = conductor
}

function backlogStory(): number {
  const story = stories.writeStory({ epicId, title: 'Multiply two numbers for the customer', body: BODY })
  stories.writeTwin({ storyId: story.id, title: 'tests multiply', body: 'cases...' })
  const criteria = createCriterionRepository(db)
  criteria.declareCriterion({ storyId: story.id, reference: 'AC-1', statement: 'two numbers are multiplied' })
  criteria.declareCriterion({ storyId: story.id, reference: 'AC-2', statement: 'the product is exact' })
  stories.sendToBacklog(story.id)
  return story.id
}

function cardOf(storyId: number): ForgeCardView {
  const found = board.list(projectId).find((card) => card.storyId === storyId)
  if (found === undefined) {
    throw new Error(`no card for story ${storyId}`)
  }
  return found
}

function worktreeOf(storyId: number): string {
  const found = worktrees.findForStory(storyId)
  if (found === null) {
    throw new Error(`no worktree for story ${storyId}`)
  }
  return found.path
}

function writeProof(storyId: number, name: 'spec_done' | 'arch_done'): void {
  const reference = stories.findStory(storyId).reference
  const sections = EVIDENCE_SHAPE[name].map((section) => `## ${section}`).join('\n')
  writeEvidenceFile(worktreeOf(storyId), proofPathOf(reference, name), `${sections}\n\n${PROSE}\n`)
}

async function endTurn(storyId: number, verdict: Record<string, unknown>): Promise<void> {
  const latest = sessions.latestSessionOf(storyId)
  if (latest === null) {
    throw new Error('no session to finish')
  }
  sessions.updateLifecycle(latest.claudeSessionId, 'awaiting_human')
  const reference = stories.findStory(storyId).reference
  writeEvidenceFile(worktreeOf(storyId), verdictPathOf(reference, cardOf(storyId).stepKey), JSON.stringify(verdict))
  await conductor.turnEnded(latest.claudeSessionId)
}

async function runAgentSteps(storyId: number): Promise<void> {
  await conductor.tick()
  expect(cardOf(storyId).stepKey).toBe('spec')
  writeProof(storyId, 'spec_done')
  await endTurn(storyId, { status: 'pass' })
  expect(cardOf(storyId).stepKey).toBe('plan')
  writeProof(storyId, 'arch_done')
  await endTurn(storyId, { status: 'pass' })
  expect(cardOf(storyId).stepKey).toBe('build')
  commitFiles(
    worktreeOf(storyId),
    { 'test/multiply.test.js': MULTIPLY_TEST, 'src/multiply.js': MULTIPLY_SOURCE },
    'feat: multiply two numbers',
  )
  await endTurn(storyId, { status: 'pass', reason: 'tests and code committed' })
  expect(cardOf(storyId).stepKey).toBe('review')
  await endTurn(storyId, PASSING_REVIEW)
  expect(cardOf(storyId).stepKey).toBe('ship')
}

beforeEach(boot)

afterEach(() => {
  project.remove()
})

describe('the default template, with no human click', () => {
  it('takes a card from the backlog to Done on proofs the orchestrator checked itself', async () => {
    const storyId = backlogStory()

    await runAgentSteps(storyId)
    await endTurn(storyId, { status: 'pass', reason: 'shipped' })

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'done', status: 'done' })
    expect(launched).toEqual(['spec', 'architecture', 'code', 'review', 'ship'])
    expect(
      checkpoints
        .definitionOfDone(storyId)
        .filter((step) => step.proven)
        .map((step) => step.name),
    ).toEqual(['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified', 'reviewed'])
    expect(checkpoints.reviewCascade(storyId).map((pass) => pass.state)).toEqual(['passed', 'passed', 'passed'])
    expect(createCriterionRepository(db).listCriteria(storyId).every((criterion) => criterion.satisfied)).toBe(true)
    expect(stories.findStory(storyId).state).toBe('done')
  })

  it('pushes the branch, treats a plain remote as open-the-request-by-hand, and removes the worktree', async () => {
    const storyId = backlogStory()
    await runAgentSteps(storyId)
    const path = worktreeOf(storyId)
    const branch = worktrees.findForStory(storyId)?.branch ?? ''

    await endTurn(storyId, { status: 'pass' })

    expect(closedWith?.publication).toMatchObject({ pushed: true, requestUrl: null, mergeRequested: false })
    expect(closedWith?.publication?.note).toContain('open the merge request by hand')
    expect(git(project.origin, 'branch', '--list', branch)).toContain(branch)
    expect(closedWith?.cleanUp).toMatchObject({ worktreeClosed: true, worktreeRefusal: null })
    expect(existsSync(path)).toBe(false)
    expect(git(project.checkout, 'branch', '--list', branch)).toBe('')
    expect(cardOf(storyId).stepKey).toBe('done')
  })

  it('still reaches Done when the checkout has no remote, keeping the branch for a hand push', async () => {
    git(project.checkout, 'remote', 'remove', 'origin')
    const storyId = backlogStory()
    await runAgentSteps(storyId)
    const path = worktreeOf(storyId)
    const branch = worktrees.findForStory(storyId)?.branch ?? ''

    await endTurn(storyId, { status: 'pass' })

    expect(cardOf(storyId).stepKey).toBe('done')
    expect(closedWith?.publication).toMatchObject({ pushed: false, requestUrl: null })
    expect(closedWith?.publication?.note).toContain('no origin remote')
    expect(existsSync(path)).toBe(false)
    expect(git(project.checkout, 'branch', '--list', branch)).toContain(branch)
  })
})

describe('an agent that claims more than it did', () => {
  it('does not move on from Build when nothing was committed, and says why', async () => {
    const storyId = backlogStory()
    await conductor.tick()
    writeProof(storyId, 'spec_done')
    await endTurn(storyId, { status: 'pass' })
    writeProof(storyId, 'arch_done')
    await endTurn(storyId, { status: 'pass' })
    const before = launched.length

    await endTurn(storyId, { status: 'pass', reason: 'everything is done' })

    expect(cardOf(storyId).stepKey).toBe('build')
    expect(launched.length).toBe(before + 1)
    expect(db.prepare('SELECT name FROM checkpoint WHERE story_id = ?').all(storyId)).toHaveLength(2)
  })

  it('stops red after the retries when the tests never fail without the code', async () => {
    const storyId = backlogStory()
    await conductor.tick()
    writeProof(storyId, 'spec_done')
    await endTurn(storyId, { status: 'pass' })
    writeProof(storyId, 'arch_done')
    await endTurn(storyId, { status: 'pass' })
    commitFiles(
      worktreeOf(storyId),
      { 'test/other.test.js': "import test from 'node:test'\ntest('noop', () => undefined)\n", 'src/multiply.js': MULTIPLY_SOURCE },
      'feat: multiply',
    )

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await endTurn(storyId, { status: 'pass' })
    }

    const card = cardOf(storyId)
    expect(card.stepKey).toBe('build')
    expect(card.auto).toMatchObject({ state: 'red' })
    expect(card.auto?.reason).toContain('also pass when the production code')
  })
})
