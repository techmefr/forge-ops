import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { RedNotAssertedError } from '../../../src/domain/Checkpoint/CheckpointViolation.js'
import type { TestReport } from '../../../src/domain/RedProof/RedProof.js'

const EVIDENCE = '.claude/evidence/FORGE-1/tests.md'
const ASSERTION_MESSAGE = 'AssertionError: expected 1 to be 2'

let db: Database.Database
let stories: StoryRepository
let storyId: number
let surveys: number

const RED: TestReport = {
  files: [
    {
      name: 'backend/tests/domain/Thing.test.ts',
      message: '',
      assertions: [{ fullName: 'is red', status: 'failed', failureMessages: [ASSERTION_MESSAGE] }],
    },
  ],
}

const UNCOLLECTED: TestReport = {
  files: [
    {
      name: 'backend/tests/domain/Thing.test.ts',
      message: "Cannot find module './Missing.js'",
      assertions: [],
    },
  ],
}

const GREEN: TestReport = {
  files: [
    {
      name: 'backend/tests/domain/Thing.test.ts',
      message: '',
      assertions: [{ fullName: 'is green', status: 'passed', failureMessages: [] }],
    },
  ],
}

function repositoryReporting(report: TestReport): CheckpointRepository {
  return createCheckpointRepository(db, {
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    surveyRed: () => {
      surveys += 1
      return report
    },
  })
}

function proveUpToTests(checkpoints: CheckpointRepository): void {
  for (const name of ['spec_done', 'arch_done'] as const) {
    checkpoints.proveCheckpoint({ storyId, name, evidencePath: EVIDENCE })
  }
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  surveys = 0
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'Gate', businessIntent: 'prouver le rouge' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'prouver le rouge', body: 'en tant que...' }).id
  stories.writeTwin({ storyId, title: 'tests prouver le rouge', body: 'cas...' })
  createCriterionRepository(db).declareCriterion({
    storyId,
    reference: 'AC-1',
    statement: 'un rouge non assertif refuse tests_written',
  })
})

describe('tests_written consults the red verdict', () => {
  it('refuses tests_written when the suite failed to collect', () => {
    const checkpoints = repositoryReporting(UNCOLLECTED)
    proveUpToTests(checkpoints)

    expect(() =>
      checkpoints.proveCheckpoint({ storyId, name: 'tests_written', evidencePath: EVIDENCE }),
    ).toThrow(RedNotAssertedError)
  })

  it('names the collection failure in the refusal', () => {
    const checkpoints = repositoryReporting(UNCOLLECTED)
    proveUpToTests(checkpoints)

    expect(() =>
      checkpoints.proveCheckpoint({ storyId, name: 'tests_written', evidencePath: EVIDENCE }),
    ).toThrow(/Cannot find module/)
  })

  it('refuses tests_written when the suite is green', () => {
    const checkpoints = repositoryReporting(GREEN)
    proveUpToTests(checkpoints)

    expect(() =>
      checkpoints.proveCheckpoint({ storyId, name: 'tests_written', evidencePath: EVIDENCE }),
    ).toThrow(RedNotAssertedError)
  })

  it('refuses tests_written when the suite is empty', () => {
    const checkpoints = repositoryReporting({ files: [] })
    proveUpToTests(checkpoints)

    expect(() =>
      checkpoints.proveCheckpoint({ storyId, name: 'tests_written', evidencePath: EVIDENCE }),
    ).toThrow(RedNotAssertedError)
  })

  it('lets tests_written through on a failing assertion', () => {
    const checkpoints = repositoryReporting(RED)
    proveUpToTests(checkpoints)

    expect(checkpoints.proveCheckpoint({ storyId, name: 'tests_written', evidencePath: EVIDENCE })).toMatchObject(
      { name: 'tests_written' },
    )
  })

  it('takes the census only once the red is proven', () => {
    const taken: number[] = []
    const checkpoints = createCheckpointRepository(db, {
      takeCensus: () => {
        taken.push(1)
        return { tests: 0, skipped: 0, tautologies: 0 }
      },
      surveyRed: () => UNCOLLECTED,
    })
    proveUpToTests(checkpoints)

    expect(() =>
      checkpoints.proveCheckpoint({ storyId, name: 'tests_written', evidencePath: EVIDENCE }),
    ).toThrow(RedNotAssertedError)
    expect(taken).toEqual([])
  })

  it('leaves the other checkpoints out of the red survey', () => {
    const checkpoints = repositoryReporting(UNCOLLECTED)

    expect(checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE })).toMatchObject({
      name: 'spec_done',
    })
    expect(surveys).toBe(0)
  })

  it('lets tests_written through when no red survey is wired', () => {
    const checkpoints = createCheckpointRepository(db, {
      takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    })
    proveUpToTests(checkpoints)

    expect(checkpoints.proveCheckpoint({ storyId, name: 'tests_written', evidencePath: EVIDENCE })).toMatchObject(
      { name: 'tests_written' },
    )
  })
})
