import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createProjectWorkflowRepository,
  type ProjectWorkflowRepository,
} from '../../../src/domain/Workflow/ProjectWorkflowRepository.js'
import {
  createWorkflowColumnRepository,
  type WorkflowColumnRepository,
} from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import {
  WorkflowInUseError,
  WorkflowNotFoundError,
  WorkflowRefusedError,
} from '../../../src/domain/Workflow/ProjectWorkflowViolation.js'
import type { WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'

const STEP: WorkflowColumnDraft = {
  label: 'Build',
  colour: '#0F9D8A',
  provider: 'claude',
  model: 'claude-sonnet-5',
  effort: 'high',
  agentName: '',
  command: '',
  preprompt: 'Follow the plan.',
  autoStart: true,
}

let db: Database.Database
let workflows: ProjectWorkflowRepository
let columns: WorkflowColumnRepository
let alpha: number
let beta: number

function insertProject(slug: string): number {
  return Number(
    db
      .prepare('INSERT INTO project (slug, name, repository_url, integration_branch, colour) VALUES (?, ?, ?, ?, ?)')
      .run(slug, slug, 'git@example.com:x/y.git', 'main', '#112233').lastInsertRowid,
  )
}

function refusalOf(action: () => unknown): unknown {
  try {
    action()
  } catch (error) {
    if (error instanceof WorkflowRefusedError) {
      return error.refusal
    }
    throw error
  }
  return null
}

beforeEach(() => {
  db = openDatabase(':memory:')
  workflows = createProjectWorkflowRepository(db)
  columns = createWorkflowColumnRepository(db)
  alpha = insertProject('alpha')
  beta = insertProject('beta')
})

describe('the workflows of a project', () => {
  it('has none until something needs one, then makes a Default', () => {
    expect(workflows.list(alpha)).toEqual([])

    const made = workflows.defaultOf(alpha)

    expect(made).toMatchObject({ projectId: alpha, key: 'default', name: 'Default', position: 1 })
    expect(workflows.defaultOf(alpha).id).toBe(made.id)
  })

  it('puts the steps created without a workflow in the first one', () => {
    const step = columns.create(alpha, STEP)

    expect(step.workflowId).toBe(workflows.defaultOf(alpha).id)
  })

  it('lets a project hold several, each with its own steps', () => {
    const feature = workflows.defaultOf(alpha)
    const fix = workflows.create(alpha, 'Hotfix')
    columns.create(alpha, STEP, feature.id)
    columns.create(alpha, { ...STEP, label: 'Verify' }, fix.id)
    columns.create(alpha, STEP, fix.id)

    expect(columns.list(alpha, feature.id).map((step) => step.key)).toEqual(['build'])
    expect(columns.list(alpha, fix.id).map((step) => step.key)).toEqual(['verify', 'build'])
    expect(columns.list(alpha).map((step) => step.key)).toEqual(['build'])
  })

  it('keeps the same step label free in another workflow', () => {
    const feature = workflows.defaultOf(alpha)
    const fix = workflows.create(alpha, 'Fix')
    columns.create(alpha, STEP, feature.id)

    expect(() => columns.create(alpha, STEP, feature.id)).toThrow()
    expect(columns.create(alpha, STEP, fix.id).workflowId).toBe(fix.id)
  })

  it('refuses a workflow of another project', () => {
    const other = workflows.defaultOf(beta)

    expect(() => columns.list(alpha, other.id)).toThrow(WorkflowNotFoundError)
    expect(() => columns.create(alpha, STEP, other.id)).toThrow(WorkflowNotFoundError)
  })

  it('refuses an empty name and a name already taken', () => {
    workflows.defaultOf(alpha)

    expect(refusalOf(() => workflows.create(alpha, '  '))).toEqual({ reason: 'EmptyName' })
    expect(refusalOf(() => workflows.create(alpha, 'default'))).toEqual({ reason: 'DuplicateName', name: 'default' })
  })

  it('renames a workflow and keeps its key', () => {
    const made = workflows.create(alpha, 'Fix')

    const renamed = workflows.rename(alpha, made.id, 'Bug fix')

    expect(renamed).toMatchObject({ id: made.id, key: 'fix', name: 'Bug fix' })
  })

  it('duplicates a workflow with its steps', () => {
    const feature = workflows.defaultOf(alpha)
    columns.create(alpha, STEP, feature.id)
    columns.create(alpha, { ...STEP, label: 'Review' }, feature.id)

    const copy = workflows.duplicate(alpha, feature.id, 'Feature v2')

    expect(columns.list(alpha, copy.id).map((step) => [step.key, step.position])).toEqual([
      ['build', 1],
      ['review', 2],
    ])
    expect(columns.list(alpha, copy.id)[0]?.id).not.toBe(columns.list(alpha, feature.id)[0]?.id)
  })

  it('removes a workflow and its steps, and renumbers the others', () => {
    const feature = workflows.defaultOf(alpha)
    const fix = workflows.create(alpha, 'Fix')
    const chore = workflows.create(alpha, 'Chore')
    columns.create(alpha, STEP, fix.id)

    workflows.remove(alpha, fix.id)

    expect(workflows.list(alpha).map((workflow) => [workflow.key, workflow.position])).toEqual([
      [feature.key, 1],
      [chore.key, 2],
    ])
    expect(db.prepare('SELECT COUNT(*) AS total FROM workflow_column').get()).toEqual({ total: 0 })
  })

  it('keeps the last workflow of a project', () => {
    const only = workflows.defaultOf(alpha)

    expect(refusalOf(() => workflows.remove(alpha, only.id))).toEqual({ reason: 'LastWorkflow' })
  })

  it('keeps a workflow that still holds stories', () => {
    workflows.defaultOf(alpha)
    const fix = workflows.create(alpha, 'Fix')
    const epic = Number(
      db.prepare("INSERT INTO epic (project_id, title, business_intent) VALUES (?, 'E', 'i')").run(alpha).lastInsertRowid,
    )
    db.prepare(
      "INSERT INTO story (epic_id, reference, title, body, kind, workflow_id) VALUES (?, 'S-1', 't', 'b', 'functional', ?)",
    ).run(epic, fix.id)

    expect(() => workflows.remove(alpha, fix.id)).toThrow(WorkflowInUseError)
  })
})
