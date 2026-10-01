import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createCheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import { createStepEntry } from '../../../src/domain/Dispatch/StepEntry.js'
import { createDispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { createBudgetRepository, type BudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import {
  createWorkflowColumnRepository,
  type WorkflowColumnRepository,
} from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import { createForgeCardRepository } from '../../../src/domain/ForgeCard/ForgeCardRepository.js'
import {
  createForgeBoardRepository,
  type ForgeBoardRepository,
} from '../../../src/domain/ForgeCard/ForgeBoardRepository.js'
import { createForgeCardMover } from '../../../src/domain/ForgeCard/ForgeCardMover.js'
import { createForgeCardCloser, type ForgeCardCloser } from '../../../src/domain/ForgeCard/ForgeCardCloser.js'
import {
  createAutopilotConductor,
  type AutopilotConductor,
} from '../../../src/domain/Autopilot/AutopilotConductor.js'
import {
  createAutopilotRepository,
  type AutopilotRepository,
} from '../../../src/domain/Autopilot/AutopilotRepository.js'
import { proofPathOf, verdictPathOf } from '../../../src/domain/Autopilot/StepBrief.js'
import { EVIDENCE_SHAPE } from '../../../src/domain/Evidence/EvidenceShape.js'
import type { EvidenceReader } from '../../../src/domain/Evidence/EvidenceRead.js'
import type { LaunchOrder } from '../../../src/domain/Dispatch/Dispatch.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'
import type { WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'
import type { ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import { MAX_AUTO_TRANSITIONS } from '../../../../contract/AutopilotContract.js'

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

const HUMAN_STEP: WorkflowColumnDraft = {
  ...AGENT_STEP,
  label: 'Validation',
  provider: 'human',
  model: '',
  effort: '',
  autoStart: false,
}

const BODY = [
  'As a manager, I want to see the mails of a customer',
  'so that I find an exchange without opening the mailbox.',
  '',
  'The list is paginated by twenty, newest first.',
  'When the customer has no mail, the page says so.',
].join('\n')

const PROSE = Array.from({ length: 50 }, (_unused, index) => `word${index}`).join(' ')

type Verdict = { status: 'pass' | 'fail' | 'blocked'; reason?: string }

let db: Database.Database
let stories: StoryRepository
let sessions: AgentSessionRepository
let budget: BudgetRepository
let columns: WorkflowColumnRepository
let board: ForgeBoardRepository
let autopilot: AutopilotRepository
let conductor: AutopilotConductor
let closer: ForgeCardCloser
let closed: number[]
let launched: LaunchOrder[]
let evidence: Map<string, string>
let projectId: number
let epicId: number
let checkoutPath: string

const reader: EvidenceReader = (path, root) => {
  const content = evidence.get(`${root}|${path}`)
  return content === undefined ? { kind: 'unreadable', reason: 'missing' } : { kind: 'read', content }
}

function rootOf(storyId: number): string {
  return `/work/${storyId}`
}

function boot(steps: readonly WorkflowColumnDraft[], concurrencyCap = 5): void {
  db = openDatabase(':memory:')
  evidence = new Map()
  launched = []
  closed = []
  const forgeCards = createForgeCardRepository(db)
  stories = createStoryRepository(db, {
    onBacklog: (story) => forgeCards.attachCardToStory(story.id),
    checkoutRoots: ['/work'],
  })
  sessions = createAgentSessionRepository(db)
  budget = createBudgetRepository(db)
  columns = createWorkflowColumnRepository(db)
  autopilot = createAutopilotRepository(db)
  projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  checkoutPath = '/work/project'
  stories.setCheckoutPath(projectId, checkoutPath)
  epicId = stories.createEpic({ projectId, title: 'CRUD Mail', businessIntent: 'manage' }).id
  for (const step of steps) {
    columns.create(projectId, step)
  }
  const checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    readEvidence: reader,
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    checkoutOf: rootOf,
  })
  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints,
    criteria: createCriterionRepository(db),
    sessions,
    budget,
    foremerge: createForemergeRepository(db, { stories }),
    runner: {
      launch: async (order) => {
        launched.push(order)
        return { claudeSessionId: `session-${launched.length}` }
      },
    },
    concurrencyCap,
    claudeCodeVersion: '2.1.224',
  })
  const holder: { conductor: AutopilotConductor | null } = { conductor: null }
  board = createForgeBoardRepository(db, {
    forgeCards,
    columns,
    autoOf: (view) => holder.conductor?.autoViewOf(view) ?? null,
  })
  const mover = createForgeCardMover({
    board,
    forgeCards,
    stories,
    columns,
    enterStep: createStepEntry({ dispatcher, columns }),
    launchStep: (entry) => dispatcher.dispatch(entry),
  })
  const realCloser = createForgeCardCloser({
    board,
    forgeCards,
    stories,
    columns,
    checkpoints,
    criteria: createCriterionRepository(db),
    cleanUpAfterMerge: () => ({ scopesReleased: 0, worktreeClosed: true, worktreeRefusal: null }),
  })
  closer = {
    close: (forgeCardId) => {
      const result = realCloser.close(forgeCardId)
      closed.push(forgeCardId)
      return result
    },
  }
  conductor = createAutopilotConductor({
    autopilot,
    board,
    forgeCards,
    stories,
    columns,
    sessions,
    checkpoints,
    readEvidence: reader,
    cwdOf: rootOf,
    clearVerdict: (root, path) => {
      evidence.delete(`${root}|${path}`)
    },
    mover,
    closer,
    lastAgentMessage: () => 'I could not finish the step',
  })
  holder.conductor = conductor
}

function backlogStory(title: string): number {
  const story = stories.writeStory({ epicId, title: `${title} for the customer concerned`, body: BODY })
  stories.writeTwin({ storyId: story.id, title: `tests ${title}`, body: 'cases...' })
  const criteria = createCriterionRepository(db)
  criteria.declareCriterion({ storyId: story.id, reference: 'AC-1', statement: 'the expected behaviour' })
  criteria.declareCriterion({ storyId: story.id, reference: 'AC-2', statement: 'the empty case is announced' })
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

function proof(storyId: number, name: 'spec_done' | 'arch_done'): void {
  const reference = stories.findStory(storyId).reference
  const sections = EVIDENCE_SHAPE[name].map((section) => `## ${section}`).join('\n')
  evidence.set(`${rootOf(storyId)}|${proofPathOf(reference, name)}`, `${sections}\n\n${PROSE}\n`)
}

async function finishTurn(storyId: number, verdict: Verdict | null, stepKey = cardOf(storyId).stepKey): Promise<void> {
  const latest = sessions.latestSessionOf(storyId)
  if (latest === null) {
    throw new Error('no session to finish')
  }
  sessions.updateLifecycle(latest.claudeSessionId, 'awaiting_human')
  if (verdict !== null) {
    const reference = stories.findStory(storyId).reference
    evidence.set(`${rootOf(storyId)}|${verdictPathOf(reference, stepKey)}`, JSON.stringify(verdict))
  }
  await conductor.turnEnded(latest.claudeSessionId)
}

async function startFromBacklog(storyId: number): Promise<void> {
  await conductor.tick()
  expect(cardOf(storyId).stepKey).not.toBe('backlog')
}

beforeEach(() => {
  boot([
    { ...AGENT_STEP, label: 'Spec' },
    { ...AGENT_STEP, label: 'Plan' },
    { ...AGENT_STEP, label: 'Build' },
  ])
})

describe('auto-launch from the backlog', () => {
  it('starts the first auto-start step of a backlog story by itself', async () => {
    const storyId = backlogStory('see the mails')

    await conductor.tick()

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'spec', status: 'running' })
    expect(launched).toHaveLength(1)
  })

  it('does nothing when the project switched the autopilot off', async () => {
    autopilot.settle(projectId, { enabled: false, autoLaunch: true, autoPublish: true, autoMerge: false })
    const storyId = backlogStory('see the mails')

    await conductor.tick()

    expect(cardOf(storyId).stepKey).toBe('backlog')
    expect(launched).toHaveLength(0)
  })

  it('does nothing when only the auto-launch is switched off', async () => {
    autopilot.settle(projectId, { enabled: true, autoLaunch: false, autoPublish: true, autoMerge: false })
    const storyId = backlogStory('see the mails')

    await conductor.tick()

    expect(cardOf(storyId).stepKey).toBe('backlog')
  })

  it('keeps a story in the backlog when the first step is a human one', async () => {
    boot([HUMAN_STEP, AGENT_STEP])
    const storyId = backlogStory('see the mails')

    await conductor.tick()

    expect(cardOf(storyId).stepKey).toBe('backlog')
  })

  it('starts only what the concurrency cap allows and the rest as soon as there is room', async () => {
    boot([{ ...AGENT_STEP, label: 'Spec' }], 1)
    const first = backlogStory('see the mails')
    const second = backlogStory('export the contacts')

    await conductor.tick()

    expect(cardOf(first).stepKey).toBe('spec')
    expect(cardOf(second).stepKey).toBe('backlog')

    db.prepare("UPDATE agent_session SET lifecycle = 'finished', outcome = 'succeeded'").run()
    await conductor.tick()

    expect(cardOf(second).stepKey).toBe('spec')
  })

  it('stops launching while the budget is exhausted', async () => {
    budget.writePolicy({ capUsd: 1, conduct: 'stop', downgradeModel: 'claude-haiku-4-5-20251001', rerouteBaseUrl: null })
    const storyId = backlogStory('see the mails')
    const other = backlogStory('export the contacts')
    sessions.registerSession({
      storyId: other,
      claudeSessionId: 'spent',
      phase: 'spec',
      agentName: 'neo',
      claudeCodeVersion: '2.1.224',
    })
    sessions.recordUsage('spent', { costUsd: 5, inputTokens: 1, outputTokens: 1 })

    await conductor.tick()

    expect(cardOf(storyId).stepKey).toBe('backlog')
    expect(launched).toHaveLength(0)
  })
})

describe('a chain of passing steps', () => {
  it('moves the card from step to step without any human until the last step', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    proof(storyId, 'spec_done')

    await finishTurn(storyId, { status: 'pass' })

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'plan', status: 'running' })
    proof(storyId, 'arch_done')

    await finishTurn(storyId, { status: 'pass' })

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'build', status: 'running' })
    expect(launched.map((order) => order.phase)).toEqual(['spec', 'architecture', 'code'])
  })

  it('proves the checkpoint of the step itself before advancing', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    proof(storyId, 'spec_done')

    await finishTurn(storyId, { status: 'pass' })

    const proven = db.prepare("SELECT name FROM checkpoint WHERE story_id = ? ORDER BY id").all(storyId)
    expect(proven).toEqual([{ name: 'spec_done' }])
  })

  it('tells the agent where to write its verdict in the prompt of the step', async () => {
    const storyId = backlogStory('see the mails')

    await conductor.tick()

    expect(launched[0]?.prompt).toContain(`${stories.findStory(storyId).reference}/spec.verdict.json`)
  })

  it('refuses to advance when the independent proof is missing, whatever the agent says', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)

    await finishTurn(storyId, { status: 'pass' })

    expect(cardOf(storyId).stepKey).toBe('spec')
    expect(launched).toHaveLength(2)
    expect(launched[1]?.prompt).toContain('rejected')
  })

  it('goes to Done by itself at the last step when the done gate is satisfied', async () => {
    boot([{ ...AGENT_STEP, label: 'Ship' }])
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    const forgeCard = cardOf(storyId)
    const spy = { done: false }
    closer.close = () => {
      spy.done = true
      closed.push(forgeCard.id)
      return { card: forgeCard, unblocked: [], cleanUp: { scopesReleased: 0, worktreeClosed: true, worktreeRefusal: null }, publication: null }
    }

    await finishTurn(storyId, { status: 'pass' })

    expect(closed).toEqual([forgeCard.id])
    expect(spy.done).toBe(true)
  })

  it('stops red at the last step when the done gate is not earned', async () => {
    boot([{ ...AGENT_STEP, label: 'Ship' }])
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)

    await finishTurn(storyId, { status: 'pass' })

    const card = cardOf(storyId)
    expect(card.stepKey).toBe('ship')
    expect(card.auto).toMatchObject({ state: 'red' })
    expect(card.auto?.reason).toContain('requires proof of completion')
  })
})

describe('a failing step', () => {
  it('retries the step with the failure reason in the prompt', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)

    await finishTurn(storyId, { status: 'fail', reason: 'the list is not paginated' })

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'spec', status: 'running' })
    expect(launched).toHaveLength(2)
    expect(launched[1]?.prompt).toContain('the list is not paginated')
    expect(launched[1]?.prompt).toContain('I could not finish the step')
  })

  it('runs the retry on the same step and counts the attempt', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)

    await finishTurn(storyId, { status: 'fail', reason: 'first' })

    expect(autopilot.cardOf(cardOf(storyId).id)).toMatchObject({ stepKey: 'spec', attempts: 1, pending: null })
  })

  it('stops red after the retries of the step, with the reason on the card', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)

    await finishTurn(storyId, { status: 'fail', reason: 'first' })
    await finishTurn(storyId, { status: 'fail', reason: 'second' })
    await finishTurn(storyId, { status: 'fail', reason: 'third' })

    const card = cardOf(storyId)
    expect(launched).toHaveLength(3)
    expect(card.stepKey).toBe('spec')
    expect(card.auto).toEqual({ state: 'red', reason: 'Spec failed after 2 retries: third' })
  })

  it('honours the retry setting of the step', async () => {
    boot([{ ...AGENT_STEP, label: 'Spec', maxRetries: 0 }])
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)

    await finishTurn(storyId, { status: 'fail', reason: 'nope' })

    expect(launched).toHaveLength(1)
    expect(cardOf(storyId).auto).toEqual({ state: 'red', reason: 'Spec failed: nope' })
  })

  it('counts a missing verdict as a failure', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)

    await finishTurn(storyId, null)

    expect(launched).toHaveLength(2)
    expect(launched[1]?.prompt).toContain('did not write the step verdict')
  })

  it('counts a crashed session as a failure', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    const latest = sessions.latestSessionOf(storyId)
    sessions.closeSession(latest?.claudeSessionId ?? '', { exitCode: 1 })

    await conductor.turnEnded(latest?.claudeSessionId ?? '')

    expect(launched).toHaveLength(2)
    expect(launched[1]?.prompt).toContain('failed')
  })

  it('never returns to the backlog and lets Retry resume once red', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    await finishTurn(storyId, { status: 'fail', reason: 'a' })
    await finishTurn(storyId, { status: 'fail', reason: 'b' })
    await finishTurn(storyId, { status: 'fail', reason: 'c' })

    conductor.reset(cardOf(storyId).id)

    expect(cardOf(storyId).stepKey).toBe('spec')
    expect(cardOf(storyId).auto ?? null).toBeNull()
  })
})

describe('a step that did not start by itself', () => {
  it('is picked up by the next tick once the step starts automatically', async () => {
    boot([{ ...AGENT_STEP, label: 'Spec' }, { ...AGENT_STEP, label: 'Plan', autoStart: false }])
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    proof(storyId, 'spec_done')
    await finishTurn(storyId, { status: 'pass' })
    expect(cardOf(storyId)).toMatchObject({ stepKey: 'plan', status: 'idle' })
    expect(cardOf(storyId).auto).toEqual({ state: 'paused', reason: 'This step does not start automatically' })

    await conductor.tick()
    expect(cardOf(storyId).status).toBe('idle')

    const plan = columns.list(projectId).find((step) => step.key === 'plan')
    columns.update(projectId, plan?.id ?? 0, { ...AGENT_STEP, label: 'Plan', autoStart: true })
    await conductor.tick()

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'plan', status: 'running' })
    expect(launched.map((order) => order.phase)).toEqual(['spec', 'architecture'])
  })
})

describe('pauses', () => {
  it('pauses when the next step is a human one and does not start an agent', async () => {
    boot([{ ...AGENT_STEP, label: 'Spec' }, HUMAN_STEP, { ...AGENT_STEP, label: 'Build' }])
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    proof(storyId, 'spec_done')

    await finishTurn(storyId, { status: 'pass' })

    const card = cardOf(storyId)
    expect(card).toMatchObject({ stepKey: 'validation', status: 'human_review' })
    expect(card.auto).toEqual({ state: 'paused', reason: 'Waiting for a human step' })
    expect(launched).toHaveLength(1)
  })

  it('pauses with the question when the agent reports it is blocked, without moving', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)

    await finishTurn(storyId, { status: 'blocked', reason: 'Which customers are concerned?' })

    const card = cardOf(storyId)
    expect(card.stepKey).toBe('spec')
    expect(card.auto).toEqual({ state: 'paused', reason: 'Blocked: Which customers are concerned?' })
    expect(launched).toHaveLength(1)
  })

  it('continues the chain once the blocked agent answers well', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    await finishTurn(storyId, { status: 'blocked', reason: 'Which customers?' })
    proof(storyId, 'spec_done')

    await finishTurn(storyId, { status: 'pass' })

    expect(cardOf(storyId).stepKey).toBe('plan')
  })

  it('pauses on a budget stop and resumes by itself when the budget allows', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    proof(storyId, 'spec_done')
    budget.writePolicy({ capUsd: 1, conduct: 'stop', downgradeModel: 'claude-haiku-4-5-20251001', rerouteBaseUrl: null })
    const latest = sessions.latestSessionOf(storyId)
    sessions.recordUsage(latest?.claudeSessionId ?? '', { costUsd: 5, inputTokens: 1, outputTokens: 1 })

    await finishTurn(storyId, { status: 'pass' })

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'spec' })
    expect(cardOf(storyId).auto).toEqual({ state: 'paused', reason: 'Budget exhausted, waiting to resume' })

    budget.writePolicy({ capUsd: 100, conduct: 'stop', downgradeModel: 'claude-haiku-4-5-20251001', rerouteBaseUrl: null })
    await conductor.tick()

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'plan', status: 'running' })
  })

  it('shows the budget exhaustion of a running session as a pause, not a failure', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    const latest = sessions.latestSessionOf(storyId)
    sessions.closeSession(latest?.claudeSessionId ?? '', { exitCode: null, reason: 'budget' })

    expect(cardOf(storyId).auto).toEqual({ state: 'paused', reason: 'Budget exhausted, press Retry to resume' })
    expect(cardOf(storyId).stepKey).toBe('spec')
  })

  it('waits for a free slot when the fleet is saturated and advances later', async () => {
    boot([{ ...AGENT_STEP, label: 'Spec' }, { ...AGENT_STEP, label: 'Plan' }], 1)
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    proof(storyId, 'spec_done')
    const other = backlogStory('export the contacts')
    sessions.registerSession({
      storyId: other,
      claudeSessionId: 'foreign',
      phase: 'spec',
      agentName: 'neo',
      claudeCodeVersion: '2.1.224',
    })

    await finishTurn(storyId, { status: 'pass' })

    expect(cardOf(storyId).stepKey).toBe('spec')
    expect(cardOf(storyId).auto?.reason).toBe('Waiting for a free session slot')

    sessions.closeSession('foreign', { exitCode: 0 })
    await conductor.tick()

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'plan', status: 'running' })
  })
})

describe('safety', () => {
  it('stops red when a card chains more automatic transitions than the cap', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    autopilot.patchCard(cardOf(storyId).id, { advances: MAX_AUTO_TRANSITIONS })
    proof(storyId, 'spec_done')

    await finishTurn(storyId, { status: 'pass' })

    expect(cardOf(storyId).stepKey).toBe('spec')
    expect(cardOf(storyId).auto?.state).toBe('red')
    expect(cardOf(storyId).auto?.reason).toContain('automatic transitions')
  })

  it('ignores the turns of a project whose autopilot is off', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)
    autopilot.settle(projectId, { enabled: false, autoLaunch: true, autoPublish: true, autoMerge: false })
    proof(storyId, 'spec_done')

    await finishTurn(storyId, { status: 'pass' })

    expect(cardOf(storyId)).toMatchObject({ stepKey: 'spec', status: 'to_validate' })
    expect(cardOf(storyId).auto ?? null).toBeNull()
  })

  it('keeps the retry feedback bounded', async () => {
    const storyId = backlogStory('see the mails')
    await startFromBacklog(storyId)

    await finishTurn(storyId, { status: 'fail', reason: 'x'.repeat(10000) })

    expect(launched[1]?.prompt.length ?? 0).toBeLessThan(8000)
  })
})
