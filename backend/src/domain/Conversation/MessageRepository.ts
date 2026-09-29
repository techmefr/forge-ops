import type Database from 'better-sqlite3'
import type { ThreadVoice } from '../../../../contract/ConversationContract.js'
import type { ThreadMessage } from './Thread.js'

export const MESSAGE_BODY_LIMIT = 20000

export type MessageDraft = {
  storyId: number
  claudeSessionId: string
  voice: ThreadVoice
  author: string
  body: string
}

export type MessageRepository = {
  record: (draft: MessageDraft) => boolean
  listOfStory: (storyId: number) => readonly ThreadMessage[]
}

type MessageRow = {
  voice: ThreadVoice
  author: string
  body: string
  written_at: string
}

export function createMessageRepository(db: Database.Database): MessageRepository {
  const insert = db.prepare<[number, string, ThreadVoice, string, string]>(
    'INSERT INTO story_message (story_id, claude_session_id, voice, author, body) VALUES (?, ?, ?, ?, ?)',
  )
  const select = db.prepare<[number], MessageRow>(
    'SELECT voice, author, body, written_at FROM story_message WHERE story_id = ? ORDER BY id',
  )

  return {
    record: (draft) => {
      const body = draft.body.trim().slice(0, MESSAGE_BODY_LIMIT)
      if (body === '') {
        return false
      }
      insert.run(draft.storyId, draft.claudeSessionId, draft.voice, draft.author, body)
      return true
    },

    listOfStory: (storyId) =>
      select.all(storyId).map((row) => ({
        voice: row.voice,
        author: row.author,
        body: row.body,
        writtenAt: row.written_at,
      })),
  }
}
