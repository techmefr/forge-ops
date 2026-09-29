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
import { createDispatcher, type Dispatcher } from '../../../src/domain/Dispatch/Dispatcher.js'
import { createBudgetRepository } from '../../../src/domain/Budget/BudgetRepository.js'
import { createForemergeRepository } from '../../../src/domain/Foremerge/ForemergeRepository.js'
import {
  createWorkflowColumnRepository,
  type WorkflowColumnRepository,
} from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import type { LaunchOrder, SessionRunner } from '../../../src/domain/Dispatch/Dispatch.js'
import { HumanStepError, UnknownStepError } from '../../../src/domain/Dispatch/DispatchViolation.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'
import type { WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'

let db: Database.Database
let stories: StoryRepository
let sessions: AgentSessionRepository
let columns: WorkflowColumnRepository
let dispatcher: Dispatcher
let enterStep: ReturnType<typeof createStepEntry>
let launched: LaunchOrder[]
let projectId: number
let epicId: number
let storyId: number

const AGENT_STEP: WorkflowColumnDraft = {
  label: 'Spec',
  colour: '#7C3AED',
  provider: 'claude',
  model: 'claude-opus-5-5',
  effort: 'xhigh',
  agentName: 'laravel:laravel-architect',
  command: '/speckit.specify',
  preprompt: 'Read the epic and its links.',
  autoStart: true,
}

const HUMAN_STEP: WorkflowColumnDraft = {
  label: 'Validation',
  colour: 'warn',
  provider: 'human',
  model: '',
  effort: '',
  agentName: '',
  command: '',
  preprompt: '',
  autoStart: false,
}

const BODY = [
  'En tant que gestionnaire, je veux voir la liste des mails du client',
  'afin de retrouver un echange sans ouvrir sa boite.',
  '',
  'La liste est paginee par vingt, du plus recent au plus ancien.',
  'Quand le client n a aucun mail, la page le dit.',
].join('\n')

function fakeRunner(): SessionRunner {
  let counter = 0
  return {
    launch: async (order) => {
      launched.push(order)
      counter += 1
      return { claudeSessionId: `step-session-${counter}` }
    },
  }
}

function writeReadyStory(title: string, forEpic: number): number {
  const story = stories.writeStory({ epicId: forEpic, title: `${title} pour le client concerne`, body: BODY })
  stories.writeTwin({ storyId: story.id, title: `tests ${title}`, body: 'cas...' })
  const criteria = createCriterionRepository(db)
  criteria.declareCriterion({ storyId: story.id, reference: 'AC-1', statement: 'le comportement attendu' })
  criteria.declareCriterion({ storyId: story.id, reference: 'AC-2', statement: 'le cas vide est annonce' })
  return story.id
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  sessions = createAgentSessionRepository(db)
  columns = createWorkflowColumnRepository(db)
  launched = []
  projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  }).id
  epicId = stories.createEpic({ projectId, title: 'CRUD Mail', businessIntent: 'gerer' }).id
  storyId = writeReadyStory('visualiser les mails', epicId)
  dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db, {
      ...PERMISSIVE_CHECKPOINT_GATES,
      takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    }),
    criteria: createCriterionRepository(db),
    sessions,
    budget: createBudgetRepository(db),
    foremerge: createForemergeRepository(db, { stories }),
    runner: fakeRunner(),
    concurrencyCap: 5,
    claudeCodeVersion: '2.1.224',
  })
  enterStep = createStepEntry({ dispatcher, columns })
})

describe('dispatching from a project step', () => {
  it('hands the runner the provider, model, effort, agent and base prompt of the step', async () => {
    const step = columns.create(projectId, AGENT_STEP)

    const dispatched = await dispatcher.dispatch({ storyId, phase: 'spec', columnId: step.id })

    expect(launched[0]).toMatchObject({
      provider: 'claude',
      model: 'claude-opus-5-5',
      effort: 'xhigh',
      agentName: 'laravel:laravel-architect',
    })
    expect(dispatched.prompt).toContain('Read the epic and its links.')
    expect(dispatched.prompt).toContain('/speckit.specify')
    expect(dispatched).toMatchObject({ provider: 'claude', effort: 'xhigh', model: 'claude-opus-5-5' })
  })

  it('sends the base prompt at the top of the session', async () => {
    const step = columns.create(projectId, AGENT_STEP)

    const dispatched = await dispatcher.dispatch({ storyId, phase: 'spec', columnId: step.id })

    expect(dispatched.prompt.startsWith('Read the epic and its links.')).toBe(true)
  })

  it('takes the driver from a codex step and leaves the model to the CLI', async () => {
    const step = columns.create(projectId, {
      ...AGENT_STEP,
      label: 'Codex build',
      provider: 'codex',
      model: '',
      command: 'codex exec',
    })

    await dispatcher.dispatch({ storyId, phase: 'spec', columnId: step.id })

    expect(launched[0]).toMatchObject({ provider: 'codex', effort: 'xhigh' })
    expect(launched[0]?.model).toBeUndefined()
  })

  it('falls back to the phase agent when the step names none', async () => {
    const step = columns.create(projectId, { ...AGENT_STEP, agentName: '' })

    await dispatcher.dispatch({ storyId, phase: 'spec', columnId: step.id })

    expect(launched[0]?.agentName).toBe('architecte')
  })

  it('never starts an agent on a human step', async () => {
    const step = columns.create(projectId, HUMAN_STEP)

    await expect(dispatcher.dispatch({ storyId, phase: 'spec', columnId: step.id })).rejects.toThrow(HumanStepError)

    expect(launched).toEqual([])
    expect(db.prepare('SELECT COUNT(*) AS total FROM agent_session').get()).toEqual({ total: 0 })
  })

  it('refuses a step of another project', async () => {
    const other = stories.createProject({
      slug: 'other',
      name: 'Other',
      repositoryUrl: 'git@github.com:techmefr/other.git',
      integrationBranch: 'main',
      colour: '#00ff00',
    })
    const foreign = columns.create(other.id, AGENT_STEP)

    await expect(dispatcher.dispatch({ storyId, phase: 'spec', columnId: foreign.id })).rejects.toThrow(
      UnknownStepError,
    )
    await expect(dispatcher.dispatch({ storyId, phase: 'spec', columnId: 9999 })).rejects.toThrow(UnknownStepError)
    expect(launched).toEqual([])
  })

  it('keeps the phase defaults when no step is named', async () => {
    columns.create(projectId, AGENT_STEP)

    const dispatched = await dispatcher.dispatch({ storyId, phase: 'spec' })

    expect(dispatched.agentName).toBe('architecte')
    expect(launched[0]?.provider).toBeUndefined()
  })

  it('picks the step whose key is the phase column when none is named', async () => {
    columns.create(projectId, { ...AGENT_STEP, label: 'Architecture', agentName: 'oxydis', model: 'claude-haiku-4-5', effort: 'low' })
    const proven = await dispatcher.dispatch({ storyId, phase: 'spec' })
    sessions.updateLifecycle(proven.claudeSessionId, 'finished')
    db.prepare("INSERT INTO checkpoint (story_id, name, evidence_path) VALUES (?, 'spec_done', 'x')").run(storyId)

    const dispatched = await dispatcher.dispatch({ storyId, phase: 'architecture' })

    expect(dispatched).toMatchObject({ agentName: 'oxydis', model: 'claude-haiku-4-5', effort: 'low' })
  })
})

describe('entering a step', () => {
  it('starts the agent of an auto start step', async () => {
    const step = columns.create(projectId, AGENT_STEP)

    const started = await enterStep({ storyId, columnId: step.id, phase: 'spec' })

    expect(started).not.toBeNull()
    expect(launched).toHaveLength(1)
  })

  it('leaves a step without auto start waiting for a person to launch it', async () => {
    const step = columns.create(projectId, { ...AGENT_STEP, autoStart: false })

    expect(await enterStep({ storyId, columnId: step.id, phase: 'spec' })).toBeNull()
    expect(launched).toEqual([])
  })

  it('never starts an agent when a story enters a human step', async () => {
    const step = columns.create(projectId, HUMAN_STEP)

    expect(await enterStep({ storyId, columnId: step.id, phase: 'spec' })).toBeNull()
    expect(launched).toEqual([])
  })
})

describe('changing a step', () => {
  it('does not touch the sessions already running', async () => {
    const step = columns.create(projectId, AGENT_STEP)
    const running = await dispatcher.dispatch({ storyId, phase: 'spec', columnId: step.id })

    columns.update(projectId, step.id, { ...AGENT_STEP, provider: 'human', model: '', effort: '', autoStart: false })
    columns.remove(projectId, step.id)

    expect(launched).toHaveLength(1)
    expect(sessions.findByClaudeSessionId(running.claudeSessionId)).toMatchObject({
      lifecycle: 'starting',
      agentName: 'laravel:laravel-architect',
    })
  })
})
