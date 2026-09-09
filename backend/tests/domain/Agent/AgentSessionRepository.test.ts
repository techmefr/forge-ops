import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import { StoryNotFoundError } from '../../../src/domain/Story/StoryViolation.js'
import { UnknownAgentSessionError } from '../../../src/domain/Agent/AgentViolation.js'

let db: Database.Database
let repository: AgentSessionRepository
let storyId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@github.com:techmefr/starfleet.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({
    projectId: project.id,
    title: 'CRUD Mail',
    businessIntent: 'gerer les mails du client',
  })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser les mails', body: 'en tant que...' }).id
  repository = createAgentSessionRepository(db)
})

describe('registerSession', () => {
  it('opens a session in the starting lifecycle', () => {
    const session = repository.registerSession({
      storyId,
      claudeSessionId: '9fe24018-1111-2222-3333-444455556666',
      phase: 'code',
      agentName: 'neo',
      claudeCodeVersion: '2.1.218',
    })

    expect(session.lifecycle).toBe('starting')
    expect(session.storyId).toBe(storyId)
  })

  it('refuses a session on an unknown story', () => {
    expect(() =>
      repository.registerSession({
        storyId: 404,
        claudeSessionId: 'aaaa',
        phase: 'code',
        agentName: 'neo',
        claudeCodeVersion: '2.1.218',
      }),
    ).toThrow(StoryNotFoundError)
  })
})

describe('findByClaudeSessionId', () => {
  it('finds a registered session', () => {
    repository.registerSession({
      storyId,
      claudeSessionId: 'aaaa',
      phase: 'code',
      agentName: 'neo',
      claudeCodeVersion: '2.1.218',
    })

    expect(repository.findByClaudeSessionId('aaaa')?.agentName).toBe('neo')
  })

  it('returns nothing for a session it never registered', () => {
    expect(repository.findByClaudeSessionId('unknown')).toBeNull()
  })
})

describe('recordFileTouch', () => {
  beforeEach(() => {
    repository.registerSession({
      storyId,
      claudeSessionId: 'aaaa',
      phase: 'code',
      agentName: 'neo',
      claudeCodeVersion: '2.1.218',
    })
  })

  it('attributes a touched file to the story behind the session', () => {
    repository.recordFileTouch({ claudeSessionId: 'aaaa', path: 'src/domain/Story/StoryRepository.ts' })

    expect(repository.listTouchedPaths(storyId)).toEqual(['src/domain/Story/StoryRepository.ts'])
  })

  it('lists a path once even when the agent edits it twice', () => {
    repository.recordFileTouch({ claudeSessionId: 'aaaa', path: 'src/domain/Story/StoryRepository.ts' })
    repository.recordFileTouch({ claudeSessionId: 'aaaa', path: 'src/domain/Story/StoryRepository.ts' })

    expect(repository.listTouchedPaths(storyId)).toEqual(['src/domain/Story/StoryRepository.ts'])
  })

  it('refuses a touch from a session it never registered', () => {
    expect(() => repository.recordFileTouch({ claudeSessionId: 'unknown', path: 'src/index.ts' })).toThrow(
      UnknownAgentSessionError,
    )
  })
})

describe('listConflictingPaths', () => {
  it('names the paths two stories are both editing', () => {
    const stories = createStoryRepository(db)
    const otherStoryId = stories.writeStory({ epicId: 1, title: 'creer un mail', body: 'en tant que...' }).id
    repository.registerSession({
      storyId,
      claudeSessionId: 'aaaa',
      phase: 'code',
      agentName: 'neo',
      claudeCodeVersion: '2.1.218',
    })
    repository.registerSession({
      storyId: otherStoryId,
      claudeSessionId: 'bbbb',
      phase: 'code',
      agentName: 'trinity',
      claudeCodeVersion: '2.1.218',
    })
    repository.recordFileTouch({ claudeSessionId: 'aaaa', path: 'src/domain/Story/Story.ts' })
    repository.recordFileTouch({ claudeSessionId: 'bbbb', path: 'src/domain/Story/Story.ts' })
    repository.recordFileTouch({ claudeSessionId: 'bbbb', path: 'src/domain/Story/StoryRepository.ts' })

    expect(repository.listConflictingPaths()).toEqual([
      { path: 'src/domain/Story/Story.ts', storyIds: [storyId, otherStoryId] },
    ])
  })

  it('reports nothing when each story owns its own files', () => {
    repository.registerSession({
      storyId,
      claudeSessionId: 'aaaa',
      phase: 'code',
      agentName: 'neo',
      claudeCodeVersion: '2.1.218',
    })
    repository.recordFileTouch({ claudeSessionId: 'aaaa', path: 'src/domain/Story/Story.ts' })

    expect(repository.listConflictingPaths()).toEqual([])
  })
})
