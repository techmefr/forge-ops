import type Database from 'better-sqlite3'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { HoldDraft, RemarkDraft, RemarkVoice, StoryHold, StoryRemark } from './Discussion.js'
import { EmptyRemarkError, StoryAlreadyHeldError } from './DiscussionViolation.js'

type RemarkRow = {
  id: number
  story_id: number
  author: string
  voice: RemarkVoice
  body: string
  written_at: string
}

type HoldRow = {
  id: number
  story_id: number
  reason: string
  asked_by: string
  raised_at: string
}

export type DiscussionRepositoryInput = {
  stories: StoryRepository
}

export type DiscussionRepository = {
  writeRemark: (draft: RemarkDraft) => StoryRemark
  listRemarks: (storyId: number) => readonly StoryRemark[]
  hold: (draft: HoldDraft) => StoryHold
  openHold: (storyId: number) => StoryHold | null
  openHolds: () => readonly StoryHold[]
}

function toRemark(row: RemarkRow): StoryRemark {
  return {
    id: row.id,
    storyId: row.story_id,
    author: row.author,
    voice: row.voice,
    body: row.body,
    writtenAt: row.written_at,
  }
}

function toHold(row: HoldRow): StoryHold {
  return {
    id: row.id,
    storyId: row.story_id,
    reason: row.reason,
    askedBy: row.asked_by,
    raisedAt: row.raised_at,
  }
}

export function createDiscussionRepository(
  db: Database.Database,
  { stories }: DiscussionRepositoryInput,
): DiscussionRepository {
  const insertRemark = db.prepare<[number, string, RemarkVoice, string]>(
    'INSERT INTO story_remark (story_id, author, voice, body) VALUES (?, ?, ?, ?)',
  )
  const selectRemark = db.prepare<[number], RemarkRow>('SELECT * FROM story_remark WHERE id = ?')
  const selectRemarksOfStory = db.prepare<[number], RemarkRow>(
    'SELECT * FROM story_remark WHERE story_id = ? ORDER BY id',
  )
  const insertHold = db.prepare<[number, string, string]>(
    'INSERT INTO story_hold (story_id, reason, asked_by) VALUES (?, ?, ?)',
  )
  const selectOpenHold = db.prepare<[number], HoldRow>(
    'SELECT * FROM story_hold WHERE story_id = ? AND lifted_at IS NULL',
  )
  const selectOpenHolds = db.prepare<[], HoldRow>(
    'SELECT * FROM story_hold WHERE lifted_at IS NULL ORDER BY story_id',
  )
  const liftHold = db.prepare<[number, number]>(
    `UPDATE story_hold SET lifted_at = datetime('now'), lifted_by_remark_id = ?
      WHERE story_id = ? AND lifted_at IS NULL`,
  )

  function openHold(storyId: number): StoryHold | null {
    const row = selectOpenHold.get(storyId)
    return row === undefined ? null : toHold(row)
  }

  return {
    writeRemark: (draft) => {
      const story = stories.findStory(draft.storyId)
      const body = draft.body.trim()
      if (body === '') {
        throw new EmptyRemarkError(story.reference)
      }
      const written = insertRemark.run(story.id, draft.author, draft.voice, body)
      const remarkId = Number(written.lastInsertRowid)
      if (draft.voice === 'human') {
        liftHold.run(remarkId, story.id)
      }
      return toRemark(selectRemark.get(remarkId) as RemarkRow)
    },

    listRemarks: (storyId) => selectRemarksOfStory.all(storyId).map(toRemark),

    hold: (draft) => {
      const story = stories.findStory(draft.storyId)
      if (openHold(story.id) !== null) {
        throw new StoryAlreadyHeldError(story.reference)
      }
      insertHold.run(story.id, draft.reason, draft.askedBy)
      return toHold(selectOpenHold.get(story.id) as HoldRow)
    },

    openHold,

    openHolds: () => selectOpenHolds.all().map(toHold),
  }
}
