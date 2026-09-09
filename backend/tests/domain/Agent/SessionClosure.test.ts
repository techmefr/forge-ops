import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'

let db: Database.Database
let sessions: AgentSessionRepository
let storyId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  const stories = createStoryRepository(db)
  const project = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'forge',
    colour: '#ff3b00',
  })
  const epic = stories.createEpic({ projectId: project.id, title: 'CRUD', businessIntent: 'gerer' })
  storyId = stories.writeStory({ epicId: epic.id, title: 'visualiser', body: 'en tant que...' }).id
  sessions = createAgentSessionRepository(db)
  sessions.registerSession({
    storyId,
    claudeSessionId: 'une',
    phase: 'code',
    agentName: 'trinity',
    claudeCodeVersion: 'test',
  })
})

describe('closeSession', () => {
  it('classe une sortie propre et termine la session', () => {
    const closed = sessions.closeSession('une', { exitCode: 0 })

    expect(closed).toMatchObject({ outcome: 'succeeded', lifecycle: 'finished' })
  })

  it('classe un timeout en echec plutot qu en succes muet', () => {
    const closed = sessions.closeSession('une', { exitCode: null, timedOut: true })

    expect(closed).toMatchObject({ outcome: 'timed_out', lifecycle: 'failed' })
  })

  it('garde la classe de sortie en base, pas seulement le cycle de vie', () => {
    sessions.closeSession('une', { exitCode: null, reason: 'loop' })

    const stored = db
      .prepare<[string], { outcome: string }>('SELECT outcome FROM agent_session WHERE claude_session_id = ?')
      .get('une')

    expect(stored?.outcome).toBe('looping')
  })

  it('date la fin de la session', () => {
    sessions.closeSession('une', { exitCode: 0 })

    const stored = db
      .prepare<[string], { ended_at: string | null }>(
        'SELECT ended_at FROM agent_session WHERE claude_session_id = ?',
      )
      .get('une')

    expect(stored?.ended_at).not.toBeNull()
  })

  it('laisse une session en attente humaine ouverte plutot que de la clore en echec', () => {
    const closed = sessions.closeSession('une', { exitCode: null, reason: 'human' })

    expect(closed.lifecycle).toBe('awaiting_human')
  })

  it('refuse de clore une session inconnue', () => {
    expect(() => sessions.closeSession('inconnue', { exitCode: 0 })).toThrow()
  })
})
