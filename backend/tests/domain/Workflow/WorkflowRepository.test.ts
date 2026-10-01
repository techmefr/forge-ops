import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import {
  createWorkflowRepository,
  type WorkflowRepository,
} from '../../../src/domain/Workflow/WorkflowRepository.js'
import { SEED_WORKFLOW, WORKFLOW_CONFIG_KEY } from '../../../src/domain/Workflow/Workflow.js'

let db: Database.Database
let workflow: WorkflowRepository

function persist(value: string): void {
  db.prepare('INSERT INTO board_setting (key, value) VALUES (?, ?)').run(WORKFLOW_CONFIG_KEY, value)
}

beforeEach(() => {
  db = openDatabase(':memory:')
  workflow = createWorkflowRepository(db)
})

describe('readPhases', () => {
  it('seeds from PHASE_CONTRACTS while nothing is stored', () => {
    expect(workflow.readPhases()).toEqual(SEED_WORKFLOW)
  })

  it('rereads a stored phase list', () => {
    const stored = SEED_WORKFLOW.map((entry) =>
      entry.phase === 'code' ? { ...entry, agentName: 'oxydis', preprompt: 'write clean' } : entry,
    )
    persist(JSON.stringify(stored))

    expect(workflow.readPhases()).toEqual(stored)
  })

  it('falls back to the seed when the stored list lost a phase', () => {
    persist(JSON.stringify(SEED_WORKFLOW.filter((entry) => entry.phase !== 'ship')))

    expect(workflow.readPhases()).toEqual(SEED_WORKFLOW)
  })

  it('falls back to the seed when the stored value is not JSON', () => {
    persist('{')

    expect(workflow.readPhases()).toEqual(SEED_WORKFLOW)
  })
})
