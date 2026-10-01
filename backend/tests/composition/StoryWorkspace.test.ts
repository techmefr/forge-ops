import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../src/domain/Story/StoryRepository.js'
import { createCheckpointRepository } from '../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../src/domain/Criterion/CriterionRepository.js'
import { createAgentSessionRepository } from '../../src/domain/Agent/AgentSessionRepository.js'
import { createBudgetRepository } from '../../src/domain/Budget/BudgetRepository.js'
import { createForemergeRepository } from '../../src/domain/Foremerge/ForemergeRepository.js'
import { createWorktreeRepository } from '../../src/domain/Worktree/WorktreeRepository.js'
import { createWorkflowColumnRepository } from '../../src/domain/Workflow/WorkflowColumnRepository.js'
import { createDispatcher } from '../../src/domain/Dispatch/Dispatcher.js'
import { createStepEntry } from '../../src/domain/Dispatch/StepEntry.js'
import type { LaunchOrder } from '../../src/domain/Dispatch/Dispatch.js'
import { createGitWorktree } from '../../src/technical/Git/GitWorktree.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../src/domain/Checkpoint/PermissiveCheckpointGate.js'
import { createCheckoutResolver } from '../../src/composition/ProjectCheckout.js'
import { createStoryWorkspace } from '../../src/composition/StoryWorkspace.js'
import type { WorkflowColumnDraft } from '../../../contract/WorkflowColumnContract.js'

const BODY = [
  'En tant que gestionnaire, je veux voir la liste des mails du client',
  'afin de retrouver un echange sans ouvrir sa boite.',
  '',
  'La liste est paginee par vingt, du plus recent au plus ancien.',
  'Quand le client n a aucun mail, la page le dit.',
].join('\n')

let scratch: string
let checkout: string
let db: Database.Database
let stories: StoryRepository
let projectId: number
let epicId: number
let launched: LaunchOrder[]
let opened: number[]

function git(cwd: string, ...argv: string[]): string {
  return execFileSync('git', argv, { cwd, encoding: 'utf-8' }).trim()
}

function readyStory(title: string): number {
  const story = stories.writeStory({ epicId, title: `${title} pour le client concerne`, body: BODY })
  stories.writeTwin({ storyId: story.id, title: `tests ${title}`, body: 'cas...' })
  const criteria = createCriterionRepository(db)
  criteria.declareCriterion({ storyId: story.id, reference: 'AC-1', statement: 'le comportement attendu' })
  criteria.declareCriterion({ storyId: story.id, reference: 'AC-2', statement: 'le cas vide est annonce' })
  return story.id
}

function boot(withCheckout: boolean) {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db, { checkoutRoots: [scratch] })
  projectId = stories.createProject({
    slug: 'demo',
    name: 'Demo',
    repositoryUrl: 'git@github.com:techmefr/demo.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  if (withCheckout) {
    stories.setCheckoutPath(projectId, checkout)
  }
  epicId = stories.createEpic({ projectId, title: 'CRUD Mail', businessIntent: 'gerer' }).id
  const checkouts = createCheckoutResolver({
    stories,
    worktreePathOf: (storyId) => worktrees.findForStory(storyId)?.path ?? null,
  })
  const worktrees = createWorktreeRepository(db, {
    stories,
    git: createGitWorktree({ repositoryRoot: scratch }),
    root: join(scratch, 'worktrees'),
    checkoutOf: checkouts.checkoutOfStory,
  })
  const columns = createWorkflowColumnRepository(db)
  const dispatcher = createDispatcher({
    database: db,
    stories,
    checkpoints: createCheckpointRepository(db, {
      ...PERMISSIVE_CHECKPOINT_GATES,
      takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    }),
    criteria: createCriterionRepository(db),
    sessions: createAgentSessionRepository(db),
    budget: createBudgetRepository(db),
    foremerge: createForemergeRepository(db, { stories }),
    runner: {
      launch: async (order) => {
        launched.push(order)
        return { claudeSessionId: `session-${launched.length}` }
      },
    },
    concurrencyCap: 5,
    claudeCodeVersion: '2.1.224',
    prepareWorkspace: createStoryWorkspace({
      hasCheckout: checkouts.hasCheckout,
      worktrees,
      onOpened: (worktree) => opened.push(worktree.storyId),
    }),
  })
  return { worktrees, columns, enterStep: createStepEntry({ dispatcher, columns }) }
}

function agentStep(label: string): WorkflowColumnDraft {
  return {
    label,
    colour: '#7C3AED',
    provider: 'claude',
    model: 'claude-opus-5-5',
    effort: 'xhigh',
    agentName: '',
    command: '',
    preprompt: '',
    autoStart: true,
  }
}

beforeEach(() => {
  scratch = realpathSync(mkdtempSync(join(tmpdir(), 'forge-workspace-')))
  checkout = join(scratch, 'project')
  mkdirSync(checkout, { recursive: true })
  git(checkout, 'init', '--initial-branch=main')
  git(checkout, 'config', 'user.email', 'e2e@forge-ops.test')
  git(checkout, 'config', 'user.name', 'forge-ops e2e')
  writeFileSync(join(checkout, 'README.md'), 'demo\n')
  git(checkout, 'add', 'README.md')
  git(checkout, 'commit', '-m', 'initial')
  launched = []
  opened = []
})

afterEach(() => {
  db.close()
  rmSync(scratch, { recursive: true, force: true })
})

describe('story workspace on step entry', () => {
  it('opens a story branch worktree before the agent runs', async () => {
    const { worktrees, columns, enterStep } = boot(true)
    const storyId = readyStory('visualiser les mails')
    const step = columns.create(projectId, agentStep('Spec'))

    await enterStep({ storyId, columnId: step.id, phase: 'spec' })

    const worktree = worktrees.findForStory(storyId)
    expect(worktree).not.toBeNull()
    expect(existsSync(worktree?.path ?? '')).toBe(true)
    expect(git(checkout, 'worktree', 'list')).toContain(worktree?.branch ?? 'absent')
    expect(worktree?.branch.startsWith('story/')).toBe(true)
    expect(launched).toHaveLength(1)
    expect(opened).toEqual([storyId])
  })

  it('reuses the same worktree and branch when the card enters the next step', async () => {
    const { worktrees, columns, enterStep } = boot(true)
    const storyId = readyStory('visualiser les mails')
    const spec = columns.create(projectId, agentStep('Spec'))
    const build = columns.create(projectId, agentStep('Build'))

    await enterStep({ storyId, columnId: spec.id, phase: 'spec' })
    const first = worktrees.findForStory(storyId)
    db.prepare("UPDATE agent_session SET lifecycle = 'finished'").run()
    await enterStep({ storyId, columnId: build.id, phase: 'code' })

    expect(worktrees.findForStory(storyId)).toEqual(first)
    expect(opened).toEqual([storyId])
    expect(git(checkout, 'worktree', 'list').split('\n')).toHaveLength(2)
  })

  it('gives two cards on the same project two distinct branches', async () => {
    const { worktrees, columns, enterStep } = boot(true)
    const firstStory = readyStory('visualiser les mails')
    const secondStory = readyStory('exporter les contacts')
    const step = columns.create(projectId, agentStep('Spec'))

    await enterStep({ storyId: firstStory, columnId: step.id, phase: 'spec' })
    await enterStep({ storyId: secondStory, columnId: step.id, phase: 'spec' })

    const first = worktrees.findForStory(firstStory)
    const second = worktrees.findForStory(secondStory)
    expect(first?.branch).not.toBe(second?.branch)
    expect(first?.path).not.toBe(second?.path)
    expect(git(checkout, 'worktree', 'list').split('\n')).toHaveLength(3)
  })

  it('removes the worktree and its branch when the story is closed after the merge', async () => {
    const { worktrees, columns, enterStep } = boot(true)
    const storyId = readyStory('visualiser les mails')
    const step = columns.create(projectId, agentStep('Spec'))
    await enterStep({ storyId, columnId: step.id, phase: 'spec' })
    const worktree = worktrees.findForStory(storyId)

    worktrees.close(storyId, { deleteBranch: true })

    expect(existsSync(worktree?.path ?? '')).toBe(false)
    expect(git(checkout, 'branch', '--list', worktree?.branch ?? '')).toBe('')
    expect(worktrees.findForStory(storyId)).toBeNull()
  })

  it('does not open a worktree for a project without a checkout', async () => {
    const { worktrees, columns, enterStep } = boot(false)
    const storyId = readyStory('visualiser les mails')
    const step = columns.create(projectId, agentStep('Spec'))

    await enterStep({ storyId, columnId: step.id, phase: 'spec' })

    expect(worktrees.findForStory(storyId)).toBeNull()
    expect(launched).toHaveLength(1)
  })
})
