import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { REVIEW_LENS_SEQUENCE } from '../../../src/domain/Checkpoint/Checkpoint.js'
import {
  CheckpointAlreadyProvenError,
  CheckpointOutOfOrderError,
  EvidenceRequiredError,
  UnresolvedFindingError,
} from '../../../src/domain/Checkpoint/CheckpointViolation.js'
import { TwinRequiredError } from '../../../src/domain/Story/StoryViolation.js'
import {
  createCriterionRepository,
  type CriterionRepository,
} from '../../../src/domain/Criterion/CriterionRepository.js'
import {
  CriteriaRequiredError,
  CriteriaUnmetError,
} from '../../../src/domain/Checkpoint/CheckpointViolation.js'

const EVIDENCE = '.claude/evidence/FORGE-1/spec.md'

let db: Database.Database
let stories: StoryRepository
let checkpoints: CheckpointRepository
let criteria: CriterionRepository
let storyId: number

function prove(name: Parameters<CheckpointRepository['proveCheckpoint']>[0]['name'], evidencePath = EVIDENCE) {
  return checkpoints.proveCheckpoint({ storyId, name, evidencePath })
}

function runCascade(): void {
  const sessions = createAgentSessionRepository(db)
  for (const lens of REVIEW_LENS_SEQUENCE) {
    const claudeSessionId = `cascade-${lens}`
    sessions.registerSession({
      storyId,
      claudeSessionId,
      phase: 'review',
      agentName: `claude-${lens}`,
      claudeCodeVersion: '2.1.224',
    })
    checkpoints.startLens(storyId, lens, claudeSessionId)
    checkpoints.passLens(storyId, lens)
  }
}

function satisfyCriteria(): void {
  for (const criterion of criteria.listUnmetCriteria(storyId)) {
    criteria.satisfyCriterion(criterion.id, '.claude/evidence/FORGE-1/tests.md')
  }
}

function proveUpTo(last: string): void {
  const order = ['spec_done', 'arch_done', 'tests_written', 'build_done', 'verified', 'reviewed'] as const
  for (const name of order) {
    if (name === 'reviewed') {
      runCascade()
      satisfyCriteria()
    }
    prove(name)
    if (name === last) {
      return
    }
  }
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  checkpoints = createCheckpointRepository(db, { takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) })
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD Mail', businessIntent: 'gerer les mails' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' }).id
  stories.writeTwin({ storyId, title: 'tests visualiser les mails', body: 'cas...' })
  criteria = createCriterionRepository(db)
  criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'la liste affiche les mails du client' })
})

describe('les criteres d acceptation ferment la porte', () => {
  it('refuses spec_done on a story that declares no criterion', () => {
    const bare = stories.writeStory({
      epicId: stories.createEpic({ projectId: 1, title: 'autre', businessIntent: 'autre' }).id,
      title: 'sans critere',
      body: 'en tant que...',
    })
    stories.writeTwin({ storyId: bare.id, title: 'tests sans critere', body: 'cas...' })

    expect(() =>
      checkpoints.proveCheckpoint({ storyId: bare.id, name: 'spec_done', evidencePath: EVIDENCE }),
    ).toThrow(CriteriaRequiredError)
  })

  it('refuses reviewed while a criterion is not satisfied', () => {
    proveUpTo('verified')
    runCascade()

    expect(() => prove('reviewed')).toThrow(CriteriaUnmetError)
  })

  it('lets reviewed through once every criterion carries its proof', () => {
    proveUpTo('verified')
    runCascade()
    satisfyCriteria()

    expect(prove('reviewed')).toMatchObject({ name: 'reviewed' })
  })
})

describe('proveCheckpoint', () => {
  it('proves the first checkpoint with its evidence', () => {
    const checkpoint = prove('spec_done')

    expect(checkpoint.name).toBe('spec_done')
    expect(checkpoint.evidencePath).toBe(EVIDENCE)
  })

  it('refuses a checkpoint with no evidence, since done means proven', () => {
    expect(() => prove('spec_done', '   ')).toThrow(EvidenceRequiredError)
  })

  it('refuses to prove the same checkpoint twice', () => {
    prove('spec_done')

    expect(() => prove('spec_done')).toThrow(CheckpointAlreadyProvenError)
  })

  it('refuses a checkpoint whose predecessors are not proven', () => {
    expect(() => prove('build_done')).toThrow(CheckpointOutOfOrderError)
  })

  it('names the missing predecessor in the refusal', () => {
    prove('spec_done')

    expect(() => prove('tests_written')).toThrow(/arch_done/)
  })

  it('walks the whole sequence when each step is proven in order', () => {
    proveUpTo('reviewed')

    expect(checkpoints.definitionOfDone(storyId).every((step) => step.proven)).toBe(true)
  })
})

describe('spec_done', () => {
  it('refuses a story whose twin test story is not written', () => {
    const epic = stories.createEpic({ projectId: 1, title: 'CRUD Mail', businessIntent: 'gerer' })
    const orphan = stories.writeStory({ epicId: epic.id, title: 'supprimer les mails', body: 'en tant que...' }).id

    expect(() =>
      checkpoints.proveCheckpoint({ storyId: orphan, name: 'spec_done', evidencePath: EVIDENCE }),
    ).toThrow(TwinRequiredError)
  })
})

describe('reviewed', () => {
  function recordStrongFinding(): void {
    const sessions = createAgentSessionRepository(db)
    sessions.registerSession({
      storyId,
      claudeSessionId: 'aaaa',
      phase: 'review',
      agentName: 'seraph',
      claudeCodeVersion: '2.1.218',
    })
    checkpoints.recordFinding({
      storyId,
      claudeSessionId: 'aaaa',
      lens: 'security',
      severity: 'strong',
      path: 'src/domain/Board/BoardApi.ts',
      statement: 'la route hooks accepte une charge utile non authentifiee',
    })
  }

  it('refuses while a strong finding is unresolved', () => {
    proveUpTo('verified')
    recordStrongFinding()

    expect(() => prove('reviewed')).toThrow(UnresolvedFindingError)
  })

  it('passes once the strong finding is resolved', () => {
    proveUpTo('verified')
    recordStrongFinding()
    const [finding] = checkpoints.listUnresolvedFindings(storyId)
    checkpoints.resolveFinding(finding?.id ?? 0)
    runCascade()
    satisfyCriteria()

    expect(prove('reviewed').name).toBe('reviewed')
  })

  it('ignores a weak finding', () => {
    proveUpTo('verified')
    const sessions = createAgentSessionRepository(db)
    sessions.registerSession({
      storyId,
      claudeSessionId: 'bbbb',
      phase: 'review',
      agentName: 'aragorn',
      claudeCodeVersion: '2.1.218',
    })
    checkpoints.recordFinding({
      storyId,
      claudeSessionId: 'bbbb',
      lens: 'quality',
      severity: 'weak',
      path: 'src/forge.ts',
      statement: 'nom de variable peu clair',
    })
    runCascade()
    satisfyCriteria()

    expect(prove('reviewed').name).toBe('reviewed')
  })
})

describe('definitionOfDone', () => {
  it('lists the six steps in order, none proven, on a fresh story', () => {
    expect(checkpoints.definitionOfDone(storyId)).toEqual([
      { name: 'spec_done', proven: false, evidencePath: null },
      { name: 'arch_done', proven: false, evidencePath: null },
      { name: 'tests_written', proven: false, evidencePath: null },
      { name: 'build_done', proven: false, evidencePath: null },
      { name: 'verified', proven: false, evidencePath: null },
      { name: 'reviewed', proven: false, evidencePath: null },
    ])
  })

  it('carries the evidence of each proven step', () => {
    prove('spec_done', '.claude/evidence/FORGE-1/spec.md')
    prove('arch_done', '.claude/evidence/FORGE-1/arch.md')

    expect(checkpoints.definitionOfDone(storyId).slice(0, 3)).toEqual([
      { name: 'spec_done', proven: true, evidencePath: '.claude/evidence/FORGE-1/spec.md' },
      { name: 'arch_done', proven: true, evidencePath: '.claude/evidence/FORGE-1/arch.md' },
      { name: 'tests_written', proven: false, evidencePath: null },
    ])
  })
})
