import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
  type CheckpointRepositoryInput,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { MutationSurvivedError } from '../../../src/domain/Checkpoint/CheckpointViolation.js'
import type { MutationOutcome } from '../../../src/domain/Mutation/Mutation.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

const EVIDENCE = '.claude/evidence/FORGE-1/build.md'

let db: Database.Database
let stories: StoryRepository
let storyId: number
let surveyed: readonly string[]

function touch(path: string): void {
  const sessions = createAgentSessionRepository(db)
  const claudeSessionId = `session-${path}`
  sessions.registerSession({
    storyId,
    claudeSessionId,
    phase: 'code',
    agentName: 'claude-build',
    claudeCodeVersion: '2.1.224',
  })
  sessions.recordFileTouch({ claudeSessionId, path })
}

function repositoryReporting(outcomes: readonly MutationOutcome[]): CheckpointRepository {
  const survey: CheckpointRepositoryInput['surveyMutations'] = (paths) => {
    surveyed = paths
    return outcomes
  }
  return createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    surveyMutations: survey,
  })
}

function proveUpToBuild(checkpoints: CheckpointRepository): void {
  for (const name of ['spec_done', 'arch_done', 'tests_written'] as const) {
    checkpoints.proveCheckpoint({ storyId, name, evidencePath: EVIDENCE })
  }
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  surveyed = []
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'Gate', businessIntent: 'prouver les tests' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'verifier par mutation', body: 'en tant que...' }).id
  stories.writeTwin({ storyId, title: 'tests verifier par mutation', body: 'cas...' })
  createCriterionRepository(db).declareCriterion({
    storyId,
    reference: 'AC-1',
    statement: 'une mutation survivante refuse build_done',
  })
})

describe('build_done consults the mutation verdict', () => {
  it('refuses build_done when a mutation survived', () => {
    const checkpoints = repositoryReporting([
      { path: 'backend/src/domain/Thing.ts', operator: 'boolean_literal', line: 12, killed: false },
    ])
    touch('backend/src/domain/Thing.ts')
    proveUpToBuild(checkpoints)

    expect(() => checkpoints.proveCheckpoint({ storyId, name: 'build_done', evidencePath: EVIDENCE })).toThrow(
      MutationSurvivedError,
    )
  })

  it('names the surviving mutation in the refusal', () => {
    const checkpoints = repositoryReporting([
      { path: 'backend/src/domain/Thing.ts', operator: 'strict_comparison', line: 4, killed: false },
    ])
    touch('backend/src/domain/Thing.ts')
    proveUpToBuild(checkpoints)

    expect(() => checkpoints.proveCheckpoint({ storyId, name: 'build_done', evidencePath: EVIDENCE })).toThrow(
      /backend\/src\/domain\/Thing\.ts:4 strict_comparison/,
    )
  })

  it('lets build_done through when every mutation was killed', () => {
    const checkpoints = repositoryReporting([
      { path: 'backend/src/domain/Thing.ts', operator: 'boolean_literal', line: 12, killed: true },
    ])
    touch('backend/src/domain/Thing.ts')
    proveUpToBuild(checkpoints)

    expect(checkpoints.proveCheckpoint({ storyId, name: 'build_done', evidencePath: EVIDENCE })).toMatchObject({
      name: 'build_done',
    })
  })

  it('surveys only the mutable sources the story touched', () => {
    const checkpoints = repositoryReporting([])
    touch('backend/src/domain/Thing.ts')
    touch('backend/tests/domain/Thing.test.ts')
    touch('db/schema.sql')
    proveUpToBuild(checkpoints)
    checkpoints.proveCheckpoint({ storyId, name: 'build_done', evidencePath: EVIDENCE })

    expect(surveyed).toEqual(['backend/src/domain/Thing.ts'])
  })

  it('leaves the other checkpoints out of the mutation survey', () => {
    const checkpoints = repositoryReporting([
      { path: 'backend/src/domain/Thing.ts', operator: 'boolean_literal', line: 12, killed: false },
    ])
    touch('backend/src/domain/Thing.ts')

    expect(checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE })).toMatchObject({
      name: 'spec_done',
    })
    expect(surveyed).toEqual([])
  })

  it('lets build_done through when no survey is wired', () => {
    const checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
      takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    })
    touch('backend/src/domain/Thing.ts')
    proveUpToBuild(checkpoints)

    expect(checkpoints.proveCheckpoint({ storyId, name: 'build_done', evidencePath: EVIDENCE })).toMatchObject({
      name: 'build_done',
    })
  })
})
