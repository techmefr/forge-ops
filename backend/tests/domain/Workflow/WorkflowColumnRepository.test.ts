import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createWorkflowColumnRepository,
  type WorkflowColumnRepository,
} from '../../../src/domain/Workflow/WorkflowColumnRepository.js'
import { SEED_WORKFLOW_COLUMNS } from '../../../src/domain/Workflow/WorkflowColumn.js'
import { WorkflowColumnRefusedError } from '../../../src/domain/Workflow/WorkflowColumnViolation.js'

let db: Database.Database
let columns: WorkflowColumnRepository

beforeEach(() => {
  db = openDatabase(':memory:')
  columns = createWorkflowColumnRepository(db)
})

describe('list', () => {
  it('est seme depuis SEED_WORKFLOW_COLUMNS dans l ordre', () => {
    const listed = columns.list()
    expect(listed.map((column) => column.key)).toEqual(SEED_WORKFLOW_COLUMNS.map((seed) => seed.key))
    expect(listed.map((column) => column.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})

describe('create', () => {
  it('ajoute une colonne en derniere position', () => {
    const created = columns.create({
      key: 'triage',
      label: 'Triage',
      colour: 'line',
      agentName: 'architecte',
      command: 'TRIAGE.md',
      preprompt: '',
      behaviouralKind: 'ordinary',
    })

    expect(created.position).toBe(10)
    expect(columns.list()).toHaveLength(10)
  })

  it('refuse une cle dupliquee', () => {
    expect(() =>
      columns.create({
        key: 'backlog',
        label: 'Autre',
        colour: 'line',
        agentName: 'architecte',
        command: 'SPEC.md',
        preprompt: '',
        behaviouralKind: 'ordinary',
      }),
    ).toThrow(WorkflowColumnRefusedError)
  })

  it('refuse un agent vide sur une colonne ordinaire', () => {
    expect(() =>
      columns.create({
        key: 'triage',
        label: 'Triage',
        colour: 'line',
        agentName: '',
        command: '',
        preprompt: '',
        behaviouralKind: 'ordinary',
      }),
    ).toThrow(WorkflowColumnRefusedError)
  })
})

describe('remove', () => {
  it('supprime une colonne et resserre les positions suivantes', () => {
    const [, second] = columns.list()
    columns.remove(second!.id)

    const listed = columns.list()
    expect(listed.map((column) => column.key)).not.toContain('architecture')
    expect(listed.map((column) => column.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

})

describe('reorder', () => {
  it('replace les colonnes selon l ordre de cles fourni', () => {
    const keysInOrder = columns.list().map((column) => column.key)
    const swapped = [keysInOrder[1]!, keysInOrder[0]!, ...keysInOrder.slice(2)]

    const reordered = columns.reorder(swapped)

    expect(reordered.map((column) => column.key)).toEqual(swapped)
    expect(reordered.map((column) => column.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('refuse un ordre qui omet une colonne existante', () => {
    const keysInOrder = columns.list().map((column) => column.key)
    expect(() => columns.reorder(keysInOrder.slice(1))).toThrow(WorkflowColumnRefusedError)
  })
})

describe('update', () => {
  it('modifie le libelle, la couleur, l agent, la commande et le preprompt d une colonne existante', () => {
    const [first] = columns.list()

    const updated = columns.update(first!.id, {
      label: 'Backlog renomme',
      colour: 'acc',
      agentName: 'oxydis',
      command: 'SPEC2.md',
      preprompt: 'sois concis',
      behaviouralKind: 'ordinary',
    })

    expect(updated.label).toBe('Backlog renomme')
    expect(updated.colour).toBe('acc')
    expect(updated.agentName).toBe('oxydis')
    expect(updated.command).toBe('SPEC2.md')
    expect(updated.preprompt).toBe('sois concis')
  })
})
