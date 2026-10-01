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
import { createWorktreeRepository } from '../../src/domain/Worktree/WorktreeRepository.js'
import { createGitWorktree } from '../../src/technical/Git/GitWorktree.js'
import { createEvidenceFileReader } from '../../src/technical/Evidence/EvidenceFileReader.js'
import { createCheckoutResolver, createProofGates } from '../../src/composition/ProjectCheckout.js'
import { CheckoutMissingError } from '../../src/domain/Dispatch/DispatchViolation.js'
import { EvidenceUnreadableError } from '../../src/domain/Evidence/EvidenceRead.js'

const EVIDENCE = '.claude/evidence/FORGE-1/spec.md'

const SPEC = [
  '## scope',
  '',
  'The list of mails of a customer is paginated by twenty, newest first, and the page says so when the customer has none.',
  '',
  '## decisions',
  '',
  'We keep the existing endpoint, add a page parameter, and render an empty state when the first page is empty today.',
  '',
].join('\n')

const RED_COMMAND = [
  'node -e "',
  "require('fs').writeFileSync('red-ran.txt', '1');",
  "console.log(JSON.stringify({testResults:[{name:'a.test.ts',message:'',assertionResults:[{fullName:'x',status:'failed',failureMessages:['AssertionError: boom']}]}]}))",
  '"',
].join('')

let scratch: string
let serverRepo: string
let projectRepo: string
let db: Database.Database
let stories: StoryRepository
let storyId: number
let projectId: number

function git(cwd: string, ...argv: string[]): string {
  return execFileSync('git', argv, { cwd, encoding: 'utf-8' }).trim()
}

function initRepo(root: string, marker: string): void {
  mkdirSync(root, { recursive: true })
  git(root, 'init', '--initial-branch=main')
  git(root, 'config', 'user.email', 'e2e@forge-ops.test')
  git(root, 'config', 'user.name', 'forge-ops e2e')
  writeFileSync(join(root, 'README.md'), `${marker}\n`)
  git(root, 'add', 'README.md')
  git(root, 'commit', '-m', marker)
}

function boot(declareCheckout: boolean) {
  const resolver = createCheckoutResolver({
    stories,
    worktreePathOf: (id) => worktrees.findForStory(id)?.path ?? null,
  })
  const worktrees = createWorktreeRepository(db, {
    stories,
    git: createGitWorktree({ repositoryRoot: serverRepo }),
    root: join(scratch, 'worktrees'),
    checkoutOf: resolver.checkoutOfStory,
  })
  if (declareCheckout) {
    stories.setCheckoutPath(projectId, projectRepo)
  }
  const gates = createProofGates({
    readEvidence: createEvidenceFileReader({ root: serverRepo, evidenceRoot: join('.claude', 'evidence') }),
    testsDir: 'tests',
    redCommand: RED_COMMAND,
    mutationCommand: 'true',
    cwdForStory: resolver.cwdForStory,
  })
  return { resolver, worktrees, gates, checkpoints: createCheckpointRepository(db, gates) }
}

beforeEach(() => {
  scratch = realpathSync(mkdtempSync(join(tmpdir(), 'forge-checkout-')))
  serverRepo = join(scratch, 'server')
  projectRepo = join(scratch, 'project')
  initRepo(serverRepo, 'server repository')
  initRepo(projectRepo, 'project repository')
  db = openDatabase(':memory:')
  stories = createStoryRepository(db, { checkoutRoots: [scratch] })
  const project = stories.createProject({
    slug: 'demo',
    name: 'Demo',
    repositoryUrl: 'git@example.com:demo.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  })
  projectId = project.id
  const epic = stories.createEpic({ projectId, title: 'Mails', businessIntent: 'list the mails' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'list the mails', body: 'as a manager' }).id
  stories.writeTwin({ storyId, title: 'tests list the mails', body: 'cases' })
  createCriterionRepository(db).declareCriterion({ storyId, reference: 'AC-1', statement: 'the list is paginated' })
})

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('worktrees follow the project checkout', () => {
  it('attaches the worktree to the project repository and not to the server one', () => {
    const { worktrees } = boot(true)

    const opened = worktrees.open({ storyId, baseRef: 'HEAD' })

    expect(git(projectRepo, 'worktree', 'list')).toContain(opened.path)
    expect(git(serverRepo, 'worktree', 'list')).not.toContain(opened.path)
    expect(opened.baseSha).toBe(git(projectRepo, 'rev-parse', 'HEAD'))
    expect(opened.baseSha).not.toBe(git(serverRepo, 'rev-parse', 'HEAD'))
  })

  it('removes the worktree and its branch from the project repository', () => {
    const { worktrees } = boot(true)
    const opened = worktrees.open({ storyId, baseRef: 'HEAD' })

    worktrees.close(storyId, { deleteBranch: true })

    expect(git(projectRepo, 'worktree', 'list')).not.toContain(opened.path)
    expect(git(projectRepo, 'branch', '--list', opened.branch)).toBe('')
  })

  it('refuses to open a worktree when the project has no checkout', () => {
    const { worktrees } = boot(false)

    expect(() => worktrees.open({ storyId, baseRef: 'HEAD' })).toThrow(CheckoutMissingError)
    expect(git(serverRepo, 'worktree', 'list').split('\n')).toHaveLength(1)
  })
})

describe('the working directory of a story', () => {
  it('is the project checkout, then the worktree once it is open', () => {
    const { resolver, worktrees } = boot(true)

    expect(resolver.cwdForStory(storyId)).toBe(projectRepo)

    const opened = worktrees.open({ storyId, baseRef: 'HEAD' })

    expect(resolver.cwdForStory(storyId)).toBe(opened.path)
  })

  it('refuses a project without checkout', () => {
    const { resolver } = boot(false)

    expect(() => resolver.cwdForStory(storyId)).toThrow(CheckoutMissingError)
  })
})

describe('proofs read the project checkout', () => {
  it('accepts an evidence file written in the project checkout only', () => {
    const { checkpoints } = boot(true)
    mkdirSync(join(projectRepo, '.claude', 'evidence', 'FORGE-1'), { recursive: true })
    writeFileSync(join(projectRepo, EVIDENCE), SPEC)

    const proven = checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE })

    expect(proven.name).toBe('spec_done')
    expect(existsSync(join(serverRepo, EVIDENCE))).toBe(false)
  })

  it('does not read an evidence file that only exists in the server repository', () => {
    const { checkpoints } = boot(true)
    mkdirSync(join(serverRepo, '.claude', 'evidence', 'FORGE-1'), { recursive: true })
    writeFileSync(join(serverRepo, EVIDENCE), SPEC)

    expect(() => checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE })).toThrow(
      EvidenceUnreadableError,
    )
  })

  it('reads the evidence from the worktree once it is open', () => {
    const { checkpoints, worktrees } = boot(true)
    const opened = worktrees.open({ storyId, baseRef: 'HEAD' })
    mkdirSync(join(opened.path, '.claude', 'evidence', 'FORGE-1'), { recursive: true })
    writeFileSync(join(opened.path, EVIDENCE), SPEC)

    expect(checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE }).name).toBe('spec_done')
  })

  it('refuses a proof when the project has no checkout', () => {
    const { checkpoints } = boot(false)

    expect(() => checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE })).toThrow(
      CheckoutMissingError,
    )
  })

  it('runs the red test command in the project checkout', () => {
    const { checkpoints } = boot(true)
    const folder = join(projectRepo, '.claude', 'evidence', 'FORGE-1')
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, 'spec.md'), SPEC)
    writeFileSync(join(folder, 'plan.md'), `## breakdown\n\n## risks\n\n${SPEC}`)
    writeFileSync(join(folder, 'tests.md'), `## cases\n\n## output\n\n${SPEC}`)
    checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE })
    checkpoints.proveCheckpoint({ storyId, name: 'arch_done', evidencePath: '.claude/evidence/FORGE-1/plan.md' })
    checkpoints.proveCheckpoint({ storyId, name: 'tests_written', evidencePath: '.claude/evidence/FORGE-1/tests.md' })

    expect(existsSync(join(projectRepo, 'red-ran.txt'))).toBe(true)
    expect(existsSync(join(serverRepo, 'red-ran.txt'))).toBe(false)
  })

  it('surveys the tests of the project checkout for the census', () => {
    const { gates } = boot(true)
    mkdirSync(join(projectRepo, 'tests'), { recursive: true })
    writeFileSync(join(projectRepo, 'tests', 'a.test.ts'), "it('a', () => { expect(1).toBe(2) })\n")

    expect(gates.takeCensus(projectRepo).tests).toBe(1)
    expect(gates.takeCensus(serverRepo).tests).toBe(0)
  })

  it('refuses to survey without a resolved directory', () => {
    const { gates } = boot(true)

    expect(() => gates.surveyRed()).toThrow(RangeError)
    expect(() => gates.takeCensus()).toThrow(RangeError)
    expect(() => gates.surveyMutations(['a.ts'])).toThrow(RangeError)
  })
})
