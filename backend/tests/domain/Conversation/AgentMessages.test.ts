import { beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { createStoryRepository, type StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { createAgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import {
  createMessageRepository,
  MESSAGE_BODY_LIMIT,
  type MessageRepository,
} from '../../../src/domain/Conversation/MessageRepository.js'
import { recordMessageFromEvent } from '../../../src/domain/Conversation/MessageRecorder.js'
import { chaptersOf } from '../../../src/domain/Conversation/Thread.js'
import type { AgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'

let db: Database.Database
let stories: StoryRepository
let sessions: AgentSessionRepository
let messages: MessageRepository
let storyId: number

beforeEach(() => {
  db = openDatabase(':memory:')
  stories = createStoryRepository(db)
  sessions = createAgentSessionRepository(db)
  messages = createMessageRepository(db)
  const projectId = stories.createProject({
    slug: 'forge',
    name: 'Forge',
    repositoryUrl: 'git@example.com:forge.git',
    integrationBranch: 'main',
    colour: '#ff3b00',
  }).id
  const epicId = stories.createEpic({ projectId, title: 'Sujet', businessIntent: 'x' }).id
  storyId = stories.writeStory({ epicId, title: 'a title long enough', body: 'body' }).id
  sessions.registerSession({
    storyId,
    claudeSessionId: 'sess-1',
    phase: 'spec',
    agentName: 'architect',
    claudeCodeVersion: 'test',
  })
})

function assistant(text: unknown, claudeSessionId: unknown = 'sess-1') {
  return { name: 'session.assistant', payload: { reference: 'X', claudeSessionId, text } }
}

describe('recordMessageFromEvent', () => {
  it('keeps what the agent said, under the name of its agent', () => {
    expect(recordMessageFromEvent({ sessions, messages }, assistant('I read the spec.'))).toBe(true)

    expect(messages.listOfStory(storyId)).toMatchObject([
      { voice: 'agent', author: 'architect', body: 'I read the spec.' },
    ])
  })

  it('ignores other events, empty text and unknown sessions', () => {
    expect(recordMessageFromEvent({ sessions, messages }, { name: 'session.user', payload: { text: 'x' } })).toBe(false)
    expect(recordMessageFromEvent({ sessions, messages }, assistant('   '))).toBe(false)
    expect(recordMessageFromEvent({ sessions, messages }, assistant(undefined))).toBe(false)
    expect(recordMessageFromEvent({ sessions, messages }, assistant('hi', 'unknown'))).toBe(false)
    expect(messages.listOfStory(storyId)).toEqual([])
  })

  it('caps a very long message', () => {
    recordMessageFromEvent({ sessions, messages }, assistant('x'.repeat(MESSAGE_BODY_LIMIT + 500)))

    expect(messages.listOfStory(storyId)[0]?.body).toHaveLength(MESSAGE_BODY_LIMIT)
  })
})

describe('the thread of a story', () => {
  it('files the messages in the chapter of the session that said them', () => {
    const chapters = chaptersOf({
      sessions: [{ claudeSessionId: 'sess-1', phase: 'spec', agentName: 'architect', startedAt: '2026-09-29 10:00:00' }],
      remarks: [],
      proofs: [],
      messages: [
        { voice: 'agent', author: 'architect', body: 'Hello', writtenAt: '2026-09-29 10:00:05' },
        { voice: 'human', author: 'ana', body: 'Go on', writtenAt: '2026-09-29 10:01:00' },
      ],
    })

    const spoken = chapters.flatMap((chapter) => chapter.entries)
    expect(spoken.map((entry) => [entry.kind, entry.voice, entry.body])).toEqual([
      ['message', 'agent', 'Hello'],
      ['message', 'human', 'Go on'],
    ])
  })
})
