import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import { TestsTamperedError } from '../../../src/domain/Checkpoint/CheckpointViolation.js'
import type { TestCensus } from '../../../src/domain/Tamper/TestCensus.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

let db: Database.Database
let stories: StoryRepository
let checkpoints: CheckpointRepository
let storyId: number
let census: TestCensus

const HONEST: TestCensus = { tests: 10, skipped: 0, tautologies: 0 }

function prove(name: string): void {
  checkpoints.proveCheckpoint({
    storyId,
    name: name as never,
    evidencePath: `.claude/evidence/FORGE-1/${name}.md`,
  })
}

function walkTo(last: string): void {
  const order = ['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified', 'reviewed']
  for (const name of order.slice(0, order.indexOf(last) + 1)) {
    prove(name)
  }
}

function passCascade(): void {
  const sessions = createAgentSessionRepository(db)
  for (const lens of ['quality', 'security', 'accessibility'] as const) {
    const session = sessions.registerSession({
      storyId,
      claudeSessionId: `session-${lens}`,
      phase: 'review',
      agentName: 'elrond',
      claudeCodeVersion: 'test',
    })
    checkpoints.startLens(storyId, lens, session.claudeSessionId)
    checkpoints.passLens(storyId, lens)
  }
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  census = HONEST
  checkpoints = createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES, takeCensus: () => census })
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  const story = stories.writeStory({ epicId: epic.id, title: 'visualiser', body: 'en tant que...' })
  storyId = story.id
  stories.writeTwin({ storyId, title: 'tests', body: 'cas...' })
  const criteria = createCriterionRepository(db)
  const criterion = criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'le comportement' })
  criteria.satisfyCriterion(criterion.id, '.claude/evidence/FORGE-1/ac-1.md')
})

describe('la porte de review refuse une suite trafiquee', () => {
  it('laisse passer une suite intacte', () => {
    walkTo('verified')
    passCascade()

    expect(() => prove('reviewed')).not.toThrow()
  })

  it('refuse la review quand des tests ont disparu depuis leur ecriture', () => {
    walkTo('verified')
    passCascade()
    census = { ...HONEST, tests: 8 }

    expect(() => prove('reviewed')).toThrow(TestsTamperedError)
  })

  it('refuse la review quand un test a ete mis de cote apres coup', () => {
    walkTo('verified')
    passCascade()
    census = { ...HONEST, skipped: 1 }

    expect(() => prove('reviewed')).toThrow(TestsTamperedError)
  })

  it('refuse la review quand une assertion ne prouve plus rien', () => {
    walkTo('verified')
    passCascade()
    census = { ...HONEST, tautologies: 2 }

    expect(() => prove('reviewed')).toThrow(TestsTamperedError)
  })

  it('laisse passer une suite qui a grossi', () => {
    walkTo('verified')
    passCascade()
    census = { ...HONEST, tests: 14 }

    expect(() => prove('reviewed')).not.toThrow()
  })

  it('nomme ce qui a change dans son refus', () => {
    walkTo('verified')
    passCascade()
    census = { ...HONEST, tests: 7 }

    expect(() => prove('reviewed')).toThrow(/3 tests ont disparu/)
  })

  it('compare a ce qui etait vrai a l ecriture des tests, pas au dernier passage', () => {
    walkTo('tests_written')
    census = { ...HONEST, tests: 30 }
    prove('build_done')
    prove('verified')
    passCascade()
    census = { ...HONEST, tests: 10 }

    expect(() => prove('reviewed')).not.toThrow()
  })

  it('ne laisse pas la review passer quand aucun recensement n a ete pris', () => {
    walkTo('verified')
    passCascade()
    db.prepare('DELETE FROM test_census WHERE story_id = ?').run(storyId)

    expect(() => prove('reviewed')).toThrow(TestsTamperedError)
  })
})
