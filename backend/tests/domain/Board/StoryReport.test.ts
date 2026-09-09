import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import { createCriterionRepository, type CriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import { buildStoryReport } from '../../../src/domain/Board/StoryReport.js'

let db: Database.Database
let stories: StoryRepository
let checkpoints: CheckpointRepository
let criteria: CriterionRepository
let sessions: AgentSessionRepository
let storyId: number

function report() {
  return buildStoryReport({ storyId, stories, checkpoints, criteria, sessions })
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  checkpoints = createCheckpointRepository(db, {
    takeCensus: () => ({ tests: 12, skipped: 0, tautologies: 0 }),
  })
  criteria = createCriterionRepository(db)
  sessions = createAgentSessionRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' }).id
  stories.writeTwin({ storyId, title: 'tests', body: 'cas...' })
  criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'la liste est paginee' })
})

describe('buildStoryReport', () => {
  it('separe les faits du jugement, sans les melanger dans une seule liste', () => {
    const built = report()

    expect(Object.keys(built)).toEqual(['facts', 'judgements'])
  })

  it('compte un checkpoint prouve comme un fait, avec sa preuve', () => {
    checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: '.claude/evidence/FORGE-1/spec.md' })

    expect(report().facts).toContainEqual(
      expect.objectContaining({ kind: 'checkpoint', evidencePath: '.claude/evidence/FORGE-1/spec.md' }),
    )
  })

  it('ne presente pas un checkpoint non prouve comme un fait', () => {
    expect(report().facts.filter((fact) => fact.kind === 'checkpoint')).toHaveLength(0)
  })

  it('compte un critere satisfait comme un fait, avec sa preuve', () => {
    const criterion = criteria.listCriteria(storyId)[0]
    criteria.satisfyCriterion(criterion?.id ?? 0, '.claude/evidence/FORGE-1/ac-1.md')

    expect(report().facts).toContainEqual(
      expect.objectContaining({ kind: 'criterion', evidencePath: '.claude/evidence/FORGE-1/ac-1.md' }),
    )
  })

  it('presente un critere non satisfait comme un manque, pas comme un fait', () => {
    expect(report().facts.filter((fact) => fact.kind === 'criterion')).toHaveLength(0)
    expect(report().judgements.filter((note) => note.kind === 'criterion_unmet')).toHaveLength(1)
  })

  it('compte le finding de review comme un jugement, jamais comme un fait', () => {
    const session = sessions.registerSession({
      storyId,
      claudeSessionId: 'une',
      phase: 'review',
      agentName: 'elrond',
      claudeCodeVersion: 'test',
    })
    checkpoints.recordFinding({
      storyId,
      claudeSessionId: session.claudeSessionId,
      lens: 'quality',
      severity: 'strong',
      path: 'backend/src/x.ts',
      line: 12,
      statement: 'cette fonction fait deux choses',
    })

    expect(report().judgements).toContainEqual(
      expect.objectContaining({ kind: 'finding', statement: 'cette fonction fait deux choses' }),
    )
    expect(report().facts.map((fact) => fact.statement)).not.toContain('cette fonction fait deux choses')
  })

  it('donne le cout comme un fait mesure', () => {
    sessions.registerSession({
      storyId,
      claudeSessionId: 'une',
      phase: 'code',
      agentName: 'trinity',
      claudeCodeVersion: 'test',
    })
    sessions.recordUsage('une', { costUsd: 1.5, inputTokens: 1000, outputTokens: 200 })

    expect(report().facts).toContainEqual(expect.objectContaining({ kind: 'cost', costUsd: 1.5 }))
  })

  it('additionne les jetons de toutes les sessions de la story', () => {
    for (const id of ['une', 'deux']) {
      sessions.registerSession({
        storyId,
        claudeSessionId: id,
        phase: 'code',
        agentName: 'trinity',
        claudeCodeVersion: 'test',
      })
      sessions.recordUsage(id, { costUsd: 1, inputTokens: 500, outputTokens: 100 })
    }

    expect(report().facts).toContainEqual(
      expect.objectContaining({ kind: 'cost', inputTokens: 1000, outputTokens: 200 }),
    )
  })

  it('ne rend jamais un fait sans preuve ni mesure', () => {
    checkpoints.proveCheckpoint({ storyId, name: 'spec_done', evidencePath: '.claude/evidence/FORGE-1/spec.md' })

    const unproven = report().facts.filter(
      (fact) => fact.kind !== 'cost' && (fact.evidencePath ?? '').trim() === '',
    )

    expect(unproven).toEqual([])
  })
})

describe('recordUsage', () => {
  it('garde le cout et les jetons sur la session', () => {
    sessions.registerSession({
      storyId,
      claudeSessionId: 'une',
      phase: 'code',
      agentName: 'trinity',
      claudeCodeVersion: 'test',
    })

    const updated = sessions.recordUsage('une', { costUsd: 2, inputTokens: 10, outputTokens: 3 })

    expect(updated).toMatchObject({ costUsd: 2, inputTokens: 10, outputTokens: 3 })
  })

  it('refuse une session inconnue', () => {
    expect(() => sessions.recordUsage('inconnue', { costUsd: 1, inputTokens: 1, outputTokens: 1 })).toThrow()
  })
})
