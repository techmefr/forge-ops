import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createCriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import {
  EVIDENCE_SHAPE,
  EvidenceShapeRefusedError,
  MINIMUM_PROSE_WORDS,
} from '../../../src/domain/Evidence/EvidenceShape.js'
import { EvidenceUnreadableError } from '../../../src/domain/Evidence/EvidenceRead.js'
import { PERMISSIVE_CHECKPOINT_GATES } from '../../../src/domain/Checkpoint/PermissiveCheckpointGate.js'

const EVIDENCE = '.claude/evidence/FORGE-1/spec.md'

const PROSE = Array.from({ length: MINIMUM_PROSE_WORDS }, (_unused, index) => `mot${index}`).join(' ')

const SHAPED_SPEC = `${EVIDENCE_SHAPE.spec_done.map((section) => `## ${section}\n\n${PROSE}\n`).join('\n')}`

let db: Database.Database
let stories: StoryRepository
let storyId: number

function repositoryReading(content: string): CheckpointRepository {
  return createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    readEvidence: () => ({ kind: 'read', content }),
  })
}

function repositoryFailingToRead(reason: string): CheckpointRepository {
  return createCheckpointRepository(db, {
    ...PERMISSIVE_CHECKPOINT_GATES,
    takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }),
    readEvidence: () => ({ kind: 'unreadable', reason }),
  })
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/forge-ops.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails',
  })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' }).id
  stories.writeTwin({ storyId, title: 'tests visualiser les mails', body: 'cas...' })
  const criteria = createCriterionRepository(db)
  criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'la liste affiche les mails' })
})

describe('proveCheckpoint reads the proof it is handed', () => {
  it('refuses a proof file whose content is a single word', () => {
    const checkpoints = repositoryReading('spec_done')

    expect(() =>
      checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE }),
    ).toThrow(EvidenceShapeRefusedError)
  })

  it('records nothing when the proof is refused on its content', () => {
    const checkpoints = repositoryReading('spec_done')

    expect(() =>
      checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE }),
    ).toThrow(EvidenceShapeRefusedError)
    expect(checkpoints.definitionOfDone(storyId).every((step) => !step.proven)).toBe(true)
  })

  it('accepts a proof file that carries the shape of its checkpoint', () => {
    const checkpoints = repositoryReading(SHAPED_SPEC)

    expect(checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE }).name).toBe(
      'spec_done',
    )
  })

  it('refuses a checkpoint whose proof cannot be read', () => {
    const checkpoints = repositoryFailingToRead('fichier introuvable')

    expect(() =>
      checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE }),
    ).toThrow(EvidenceUnreadableError)
  })

  it('records nothing when the proof cannot be read', () => {
    const checkpoints = repositoryFailingToRead('fichier introuvable')

    expect(() =>
      checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE }),
    ).toThrow(EvidenceUnreadableError)
    expect(checkpoints.definitionOfDone(storyId).every((step) => !step.proven)).toBe(true)
  })

  it('says the proof is unreadable rather than malformed', () => {
    const checkpoints = repositoryFailingToRead('fichier introuvable')

    expect(() =>
      checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: EVIDENCE }),
    ).toThrow(/illisible.*fichier introuvable/)
  })
})
