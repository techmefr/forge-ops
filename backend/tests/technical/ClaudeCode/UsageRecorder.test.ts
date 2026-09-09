import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import {
  createAgentSessionRepository,
  type AgentSessionRepository,
} from '../../../src/domain/Agent/AgentSessionRepository.js'
import { recordUsageFromEvent } from '../../../src/technical/ClaudeCode/UsageRecorder.js'

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

describe('recordUsageFromEvent', () => {
  it('enregistre le cout et les jetons portes par l evenement', () => {
    const taken = recordUsageFromEvent(sessions, {
      name: 'session.result',
      payload: { claudeSessionId: 'une', costUsd: 1.5, inputTokens: 100, outputTokens: 20 },
    })

    expect(taken).toBe(true)
    expect(sessions.sumUsage(storyId)).toEqual({ costUsd: 1.5, inputTokens: 100, outputTokens: 20 })
  })

  it('ignore un evenement sans identifiant de session', () => {
    expect(recordUsageFromEvent(sessions, { name: 'session.init', payload: { costUsd: 1 } })).toBe(false)
  })

  it('ignore un evenement qui ne porte aucune mesure', () => {
    expect(
      recordUsageFromEvent(sessions, { name: 'session.assistant', payload: { claudeSessionId: 'une' } }),
    ).toBe(false)
  })

  it('ignore une session que le board ne connait pas', () => {
    expect(
      recordUsageFromEvent(sessions, {
        name: 'session.result',
        payload: { claudeSessionId: 'inconnue', costUsd: 1 },
      }),
    ).toBe(false)
  })

  it('accepte un evenement qui ne porte que les jetons, sans le cout', () => {
    recordUsageFromEvent(sessions, {
      name: 'session.result',
      payload: { claudeSessionId: 'une', inputTokens: 7, outputTokens: 3 },
    })

    expect(sessions.sumUsage(storyId)).toEqual({ costUsd: 0, inputTokens: 7, outputTokens: 3 })
  })

  it('ne fait pas exploser le flux quand la mesure est du bruit', () => {
    expect(
      recordUsageFromEvent(sessions, {
        name: 'session.result',
        payload: { claudeSessionId: 'une', costUsd: 'beaucoup' },
      }),
    ).toBe(false)
  })
})
