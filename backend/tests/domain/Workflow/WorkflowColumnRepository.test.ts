import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createWorkflowColumnRepository,
  type WorkflowColumnRepository,
} from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import {
  WorkflowColumnInUseError,
  WorkflowColumnNotFoundError,
  WorkflowColumnRefusedError,
} from '../../../src/domain/Workflow/WorkflowColumnViolation.js'
import type { WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'

let db: Database.Database
let columns: WorkflowColumnRepository
let alpha: number
let beta: number

const BUILD: WorkflowColumnDraft = {
  label: 'Build',
  colour: '#0F9D8A',
  provider: 'claude',
  model: 'claude-opus-5-5',
  effort: 'high',
  agentName: 'laravel:laravel-architect',
  command: '/speckit.plan',
  preprompt: 'Follow the plan.',
  autoStart: true,
}

const REVIEW_BY_HAND: WorkflowColumnDraft = {
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

function refusalOf(action: () => unknown): unknown {
  try {
    action()
  } catch (error) {
    if (error instanceof WorkflowColumnRefusedError) {
      return error.refusal
    }
    throw error
  }
  return null
}

function insertProject(slug: string): number {
  return Number(
    db
      .prepare(
        'INSERT INTO project (slug, name, repository_url, integration_branch, colour) VALUES (?, ?, ?, ?, ?)',
      )
      .run(slug, slug, 'url', 'main', '#112233').lastInsertRowid,
  )
}

beforeEach(() => {
  db = openDatabase(':memory:')
  columns = createWorkflowColumnRepository(db)
  alpha = insertProject('alpha')
  beta = insertProject('beta')
})

describe('list', () => {
  it('starts empty: a project has no workflow until its admin creates one', () => {
    expect(columns.list(alpha)).toEqual([])
  })

  it('never shows the steps of another project', () => {
    columns.create(alpha, BUILD)

    expect(columns.list(beta)).toEqual([])
  })
})

describe('create', () => {
  it('appends the step with a key derived from its label and its provider settings', () => {
    const created = columns.create(alpha, BUILD)

    expect(created).toMatchObject({
      projectId: alpha,
      key: 'build',
      label: 'Build',
      position: 1,
      provider: 'claude',
      model: 'claude-opus-5-5',
      effort: 'high',
      agentName: 'laravel:laravel-architect',
      command: '/speckit.plan',
      autoStart: true,
      behaviouralKind: 'ordinary',
    })
  })

  it('numbers the steps of each project on their own', () => {
    columns.create(alpha, BUILD)
    columns.create(alpha, { ...BUILD, label: 'Second' })
    const other = columns.create(beta, BUILD)

    expect(other.position).toBe(1)
    expect(columns.list(alpha).map((column) => column.position)).toEqual([1, 2])
  })

  it('lets two projects use the same step name', () => {
    columns.create(alpha, BUILD)

    expect(() => columns.create(beta, BUILD)).not.toThrow()
  })

  it('keeps keys unique inside a project when labels slug alike', () => {
    columns.create(alpha, { ...BUILD, label: 'Spec kit' })
    const other = columns.create(alpha, { ...BUILD, label: 'Spec-kit' })

    expect(other.key).toBe('spec_kit_2')
  })

  it('marks a human step as waiting for a person', () => {
    expect(columns.create(alpha, REVIEW_BY_HAND).behaviouralKind).toBe('human_wait')
  })

  it('refuses a label used twice in the project, whatever the case', () => {
    columns.create(alpha, BUILD)

    expect(refusalOf(() => columns.create(alpha, { ...BUILD, label: ' build ' }))).toEqual({
      reason: 'DuplicateLabel',
      label: 'build',
    })
  })

  it('refuses the labels of the two fixed steps', () => {
    expect(refusalOf(() => columns.create(alpha, { ...BUILD, label: 'Backlog' }))).toEqual({
      reason: 'ReservedLabel',
      label: 'Backlog',
    })
    expect(refusalOf(() => columns.create(alpha, { ...BUILD, label: 'DONE' }))).toEqual({
      reason: 'ReservedLabel',
      label: 'DONE',
    })
  })

  it('refuses a model that does not belong to the provider', () => {
    expect(refusalOf(() => columns.create(alpha, { ...BUILD, model: 'gpt-9' }))).toEqual({
      reason: 'ModelNotOfProvider',
      provider: 'claude',
      model: 'gpt-9',
    })
    expect(
      refusalOf(() => columns.create(alpha, { ...BUILD, provider: 'codex', model: 'claude-sonnet-5' })),
    ).toEqual({ reason: 'ModelNotOfProvider', provider: 'codex', model: 'claude-sonnet-5' })
  })

  it('takes the codex CLI default model only', () => {
    const created = columns.create(alpha, { ...BUILD, provider: 'codex', model: '', command: 'codex exec' })

    expect(created).toMatchObject({ provider: 'codex', model: '', command: 'codex exec' })
  })

  it('refuses a model or an effort on a human step', () => {
    expect(refusalOf(() => columns.create(alpha, { ...REVIEW_BY_HAND, model: 'claude-sonnet-5' }))).toEqual({
      reason: 'ModelNotOfProvider',
      provider: 'human',
      model: 'claude-sonnet-5',
    })
    expect(refusalOf(() => columns.create(alpha, { ...REVIEW_BY_HAND, effort: 'high' }))).toEqual({
      reason: 'EffortNotOfProvider',
      provider: 'human',
      effort: 'high',
    })
  })

  it('needs an effort on an agent step', () => {
    expect(refusalOf(() => columns.create(alpha, { ...BUILD, effort: '' }))).toEqual({
      reason: 'EffortNotOfProvider',
      provider: 'claude',
      effort: '',
    })
  })

  it('refuses to auto start a human step', () => {
    expect(refusalOf(() => columns.create(alpha, { ...REVIEW_BY_HAND, autoStart: true }))).toEqual({
      reason: 'HumanStepCannotAutoStart',
    })
  })

  it('refuses a blank label', () => {
    expect(refusalOf(() => columns.create(alpha, { ...BUILD, label: '  ' }))).toEqual({ reason: 'EmptyLabel' })
  })
})

describe('update', () => {
  it('changes the settings and keeps the key and the position', () => {
    const created = columns.create(alpha, BUILD)

    const updated = columns.update(alpha, created.id, {
      ...BUILD,
      label: 'Build fast',
      model: 'claude-haiku-4-5',
      effort: 'low',
    })

    expect(updated).toMatchObject({ key: 'build', position: 1, label: 'Build fast', model: 'claude-haiku-4-5', effort: 'low' })
  })

  it('lets a step keep its own label', () => {
    const created = columns.create(alpha, BUILD)

    expect(() => columns.update(alpha, created.id, { ...BUILD, preprompt: 'other' })).not.toThrow()
  })

  it('cannot reach a step of another project', () => {
    const created = columns.create(alpha, BUILD)

    expect(() => columns.update(beta, created.id, BUILD)).toThrow(WorkflowColumnNotFoundError)
  })
})

describe('remove', () => {
  it('deletes the step and closes the gap in the positions', () => {
    const first = columns.create(alpha, BUILD)
    columns.create(alpha, { ...BUILD, label: 'Second' })

    columns.remove(alpha, first.id)

    expect(columns.list(alpha).map((column) => [column.key, column.position])).toEqual([['second', 1]])
  })

  it('refuses while a story of the project sits in the step', () => {
    const created = columns.create(alpha, { ...BUILD, label: 'Building' })
    const epic = Number(
      db.prepare('INSERT INTO epic (project_id, title, business_intent) VALUES (?, ?, ?)').run(alpha, 'Epic', 'intent').lastInsertRowid,
    )
    db.prepare(
      "INSERT INTO story (epic_id, reference, title, body, kind, state, workflow_column_id) VALUES (?, 'S-1', 't', 'b', 'functional', 'building', ?)",
    ).run(epic, created.id)

    expect(() => columns.remove(alpha, created.id)).toThrow(WorkflowColumnInUseError)
    expect(columns.list(alpha)).toHaveLength(1)
  })

  it('refuses while a story sits in a custom step whose key is no story state', () => {
    const created = columns.create(alpha, { ...BUILD, label: 'Security audit' })
    const epic = Number(
      db.prepare('INSERT INTO epic (project_id, title, business_intent) VALUES (?, ?, ?)').run(alpha, 'Epic', 'intent').lastInsertRowid,
    )
    db.prepare(
      "INSERT INTO story (epic_id, reference, title, body, kind, state, workflow_column_id) VALUES (?, 'S-1', 't', 'b', 'functional', 'building', ?)",
    ).run(epic, created.id)

    expect(() => columns.remove(alpha, created.id)).toThrow(WorkflowColumnInUseError)
  })

  it('lets a step go once its stories moved elsewhere', () => {
    const created = columns.create(alpha, { ...BUILD, label: 'Security audit' })
    const epic = Number(
      db.prepare('INSERT INTO epic (project_id, title, business_intent) VALUES (?, ?, ?)').run(alpha, 'Epic', 'intent').lastInsertRowid,
    )
    db.prepare(
      "INSERT INTO story (epic_id, reference, title, body, kind, state, workflow_column_id) VALUES (?, 'S-1', 't', 'b', 'functional', 'backlog', NULL)",
    ).run(epic)

    columns.remove(alpha, created.id)

    expect(columns.list(alpha)).toEqual([])
  })

  it('does not count the stories of another project that share the key', () => {
    const created = columns.create(alpha, { ...BUILD, label: 'Building' })
    const epic = Number(
      db.prepare('INSERT INTO epic (project_id, title, business_intent) VALUES (?, ?, ?)').run(beta, 'Epic', 'intent').lastInsertRowid,
    )
    db.prepare("INSERT INTO story (epic_id, reference, title, body, kind, state) VALUES (?, 'S-2', 't', 'b', 'functional', 'building')").run(epic)

    expect(() => columns.remove(alpha, created.id)).not.toThrow()
  })

  it('cannot remove a step of another project', () => {
    const created = columns.create(alpha, BUILD)

    expect(() => columns.remove(beta, created.id)).toThrow(WorkflowColumnNotFoundError)
  })
})

describe('reorder', () => {
  it('puts the steps in the asked order', () => {
    columns.create(alpha, BUILD)
    columns.create(alpha, { ...BUILD, label: 'Second' })
    columns.create(alpha, { ...BUILD, label: 'Third' })

    const reordered = columns.reorder(alpha, ['third', 'build', 'second'])

    expect(reordered.map((column) => [column.key, column.position])).toEqual([
      ['third', 1],
      ['build', 2],
      ['second', 3],
    ])
  })

  it('refuses an order that misses or invents a step', () => {
    columns.create(alpha, BUILD)
    columns.create(alpha, { ...BUILD, label: 'Second' })

    expect(refusalOf(() => columns.reorder(alpha, ['build']))).toEqual({ reason: 'OrderMismatch' })
    expect(refusalOf(() => columns.reorder(alpha, ['build', 'ghost']))).toEqual({ reason: 'OrderMismatch' })
  })
})

describe('find', () => {
  it('reads a step by id whatever the project', () => {
    const created = columns.create(beta, BUILD)

    expect(columns.find(created.id)).toEqual(created)
    expect(columns.find(9999)).toBeNull()
  })
})
