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
import { ConfinedPathRefusedError } from '../../../src/domain/File/ConfinedPath.js'

let db: Database.Database
let repository: AgentSessionRepository
let storyId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
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

  it('refuses a touch naming a path outside the checkout', () => {
    expect(() =>
      repository.recordFileTouch({ claudeSessionId: 'aaaa', path: '/nonexistent-probe-target/victim.ts' }),
    ).toThrow(ConfinedPathRefusedError)
    expect(repository.listTouchedPaths(storyId)).toEqual([])
  })

  it('refuses a touch climbing above the checkout', () => {
    expect(() =>
      repository.recordFileTouch({ claudeSessionId: 'aaaa', path: '../../nonexistent-probe-target/victim.ts' }),
    ).toThrow(ConfinedPathRefusedError)
    expect(repository.listTouchedPaths(storyId)).toEqual([])
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

describe('carryUsage', () => {
  function openSession(claudeSessionId: string): void {
    repository.registerSession({
      storyId,
      claudeSessionId,
      phase: 'spec',
      agentName: 'neo',
      claudeCodeVersion: '2.1.218',
    })
  }

  it('keeps what a session already spent when a new query starts from zero', () => {
    openSession('sess-carry-1')
    repository.recordUsage('sess-carry-1', { costUsd: 0.4, inputTokens: 100, outputTokens: 40 })

    repository.carryUsage('sess-carry-1')
    repository.recordUsage('sess-carry-1', { costUsd: 0.1, inputTokens: 20, outputTokens: 5 })

    expect(repository.sumUsage(storyId)).toEqual({
      costUsd: 0.5,
      inputTokens: 120,
      outputTokens: 45,
    })
  })

  it('reports the carried spend on the session itself', () => {
    openSession('sess-carry-2')
    repository.recordUsage('sess-carry-2', { costUsd: 0.4, inputTokens: 100, outputTokens: 40 })
    repository.carryUsage('sess-carry-2')

    const session = repository.recordUsage('sess-carry-2', {
      costUsd: 0.1,
      inputTokens: 20,
      outputTokens: 5,
    })

    expect(session.costUsd).toBe(0.5)
  })

  it('leaves a fresh session at zero', () => {
    openSession('sess-carry-3')

    repository.carryUsage('sess-carry-3')

    expect(repository.sumUsage(storyId)).toEqual({ costUsd: 0, inputTokens: 0, outputTokens: 0 })
  })

  it('refuses to carry an unknown session', () => {
    expect(() => repository.carryUsage('jamais-vu')).toThrow(UnknownAgentSessionError)
  })

  it('adds up several carried queries', () => {
    openSession('sess-carry-4')
    repository.recordUsage('sess-carry-4', { costUsd: 0.2, inputTokens: 10, outputTokens: 2 })
    repository.carryUsage('sess-carry-4')
    repository.recordUsage('sess-carry-4', { costUsd: 0.3, inputTokens: 20, outputTokens: 4 })
    repository.carryUsage('sess-carry-4')
    repository.recordUsage('sess-carry-4', { costUsd: 0.5, inputTokens: 30, outputTokens: 6 })

    expect(repository.sumUsage(storyId)).toEqual({
      costUsd: 1,
      inputTokens: 60,
      outputTokens: 12,
    })
  })
})

describe('abandonRunningSessions', () => {
  function openSession(claudeSessionId: string): void {
    repository.registerSession({
      storyId,
      claudeSessionId,
      phase: 'spec',
      agentName: 'neo',
      claudeCodeVersion: '2.1.218',
    })
  }

  it('interrupts a session that was still starting', () => {
    openSession('sess-ghost-1')

    repository.abandonRunningSessions()

    expect(repository.findByClaudeSessionId('sess-ghost-1')?.lifecycle).toBe('interrupted')
  })

  it('interrupts a session that was working', () => {
    openSession('sess-ghost-2')
    repository.updateLifecycle('sess-ghost-2', 'working')

    repository.abandonRunningSessions()

    expect(repository.findByClaudeSessionId('sess-ghost-2')?.lifecycle).toBe('interrupted')
  })

  it('leaves a finished session alone', () => {
    openSession('sess-done')
    repository.updateLifecycle('sess-done', 'finished')

    repository.abandonRunningSessions()

    expect(repository.findByClaudeSessionId('sess-done')?.lifecycle).toBe('finished')
  })

  it('reports how many it abandoned', () => {
    openSession('sess-ghost-3')
    openSession('sess-ghost-4')
    repository.updateLifecycle('sess-ghost-4', 'finished')

    expect(repository.abandonRunningSessions()).toBe(1)
  })

  it('abandons nothing when everything is closed', () => {
    expect(repository.abandonRunningSessions()).toBe(0)
  })

  it('interrupts a session that was awaiting a human, since no process survived', () => {
    openSession('sess-waiting')
    repository.updateLifecycle('sess-waiting', 'awaiting_human')

    repository.abandonRunningSessions()

    expect(repository.findByClaudeSessionId('sess-waiting')?.lifecycle).toBe('interrupted')
  })
})
