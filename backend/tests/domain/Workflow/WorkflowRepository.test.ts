import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createWorkflowRepository,
  type WorkflowRepository,
} from '../../../src/domain/Workflow/WorkflowRepository.js'
import { SEED_WORKFLOW } from '../../../src/domain/Workflow/Workflow.js'
import { WorkflowRefusedError } from '../../../src/domain/Workflow/WorkflowViolation.js'

let db: Database.Database
let workflow: WorkflowRepository

beforeEach(() => {
  db = openDatabase(':memory:')
  workflow = createWorkflowRepository(db)
})

describe('readPhases', () => {
  it('seme depuis PHASE_CONTRACTS tant que rien n a ete ecrit', () => {
    expect(workflow.readPhases()).toEqual(SEED_WORKFLOW)
  })

  it('relit ce qui a ete ecrit', () => {
    const written = SEED_WORKFLOW.map((entry) =>
      entry.phase === 'code' ? { ...entry, agentName: 'oxydis', preprompt: 'ecris propre' } : entry,
    )
    workflow.writePhases(written)

    expect(workflow.readPhases()).toEqual(written)
  })
})

describe('writePhases', () => {
  it('refuse une phase manquante', () => {
    const incomplete = SEED_WORKFLOW.filter((entry) => entry.phase !== 'ship')
    expect(() => workflow.writePhases(incomplete)).toThrow(WorkflowRefusedError)
  })

  it('refuse un agent vide', () => {
    const invalid = SEED_WORKFLOW.map((entry) =>
      entry.phase === 'spec' ? { ...entry, agentName: '' } : entry,
    )
    expect(() => workflow.writePhases(invalid)).toThrow(WorkflowRefusedError)
  })

  it('ne modifie rien en base quand le refus arrive avant l ecriture', () => {
    const invalid = SEED_WORKFLOW.map((entry) =>
      entry.phase === 'spec' ? { ...entry, command: '' } : entry,
    )
    expect(() => workflow.writePhases(invalid)).toThrow(WorkflowRefusedError)
    expect(workflow.readPhases()).toEqual(SEED_WORKFLOW)
  })
})
