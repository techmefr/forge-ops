import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createCheckpointRepository,
  type CheckpointRepository,
} from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import { SelfReviewRefusedError } from '../../../src/domain/Checkpoint/CheckpointViolation.js'
import type { AgentPhase } from '../../../src/domain/Agent/AgentSession.js'

let db: Database.Database
let stories: StoryRepository
let checkpoints: CheckpointRepository
let sessions: AgentSessionRepository
let storyId: number

function session(claudeSessionId: string, phase: AgentPhase, agentName: string): string {
  sessions.registerSession({ storyId, claudeSessionId, phase, agentName, claudeCodeVersion: 'test' })
  return claudeSessionId
}

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  checkpoints = createCheckpointRepository(db, { takeCensus: () => ({ tests: 0, skipped: 0, tautologies: 0 }) })
  sessions = createAgentSessionRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser', body: 'en tant que...' }).id
})

describe('startLens', () => {
  it('accepte une session de review qui n a pas ecrit le code', () => {
    session('celle-qui-code', 'code', 'trinity')
    const reviewer = session('celle-qui-relit', 'review', 'elrond')

    expect(() => checkpoints.startLens(storyId, 'quality', reviewer)).not.toThrow()
  })

  it('refuse la session qui a ecrit le code comme relectrice', () => {
    const author = session('celle-qui-code', 'code', 'trinity')

    expect(() => checkpoints.startLens(storyId, 'quality', author)).toThrow(SelfReviewRefusedError)
  })

  it('refuse aussi la session qui a ecrit les tests comme relectrice', () => {
    const author = session('celle-qui-teste', 'tdd', 'dozer')

    expect(() => checkpoints.startLens(storyId, 'quality', author)).toThrow(SelfReviewRefusedError)
  })

  it('refuse la session qui a ecrit la spec comme relectrice', () => {
    const author = session('celle-qui-specifie', 'spec', 'architecte')

    expect(() => checkpoints.startLens(storyId, 'quality', author)).toThrow(SelfReviewRefusedError)
  })

  it('accepte la session de gate, qui ne produit pas le travail', () => {
    const gate = session('celle-qui-controle', 'gate', 'galadriel')

    expect(() => checkpoints.startLens(storyId, 'quality', gate)).not.toThrow()
  })

  it('n ouvre aucune passe quand la relectrice a ete refusee', () => {
    const author = session('celle-qui-code', 'code', 'trinity')

    try {
      checkpoints.startLens(storyId, 'quality', author)
    } catch {
      // le refus est le sujet du test precedent
    }

    expect(checkpoints.reviewCascade(storyId).every((pass) => pass.state === 'pending')).toBe(true)
  })

  it('nomme la phase de production dans son refus', () => {
    const author = session('celle-qui-code', 'code', 'trinity')

    expect(() => checkpoints.startLens(storyId, 'quality', author)).toThrow(/code/)
  })
})
