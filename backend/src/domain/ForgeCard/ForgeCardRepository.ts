import type Database from 'better-sqlite3'
import type { AgentPhase } from '../../../../contract/AgentContract.js'
import type { ForgeCard, ForgeCardDraft } from '../../../../contract/ForgeCardContract.js'
import { refusalOfSelection } from './ForgeCard.js'
import {
  DuplicateStoryIdError,
  EmptySelectionError,
  ForgeCardNotFoundError,
  ForgeStoryNotFoundError,
  StoryAlreadyOnOpenCardError,
  StoryNotInBacklogError,
} from './ForgeCardViolation.js'

type ForgeCardRow = {
  id: number
  reference: string
  claude_session_id: string | null
  current_phase: AgentPhase | null
  created_at: string
  closed_at: string | null
}

type StoryLookupRow = {
  id: number
  reference: string
  state: string
}

export type ForgeCardDispatchProgress = {
  claudeSessionId: string
  phase: AgentPhase
}

export type ForgeCardRepository = {
  createForgeCard: (draft: ForgeCardDraft) => ForgeCard
  closeForgeCard: (forgeCardId: number) => void
  openCardOfStory: (storyId: number) => ForgeCard | null
  findForgeCard: (forgeCardId: number) => ForgeCard
  recordDispatch: (forgeCardId: number, progress: ForgeCardDispatchProgress) => ForgeCard
}

export function createForgeCardRepository(db: Database.Database): ForgeCardRepository {
  const countCards = db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM forge_card')
  const insertCard = db.prepare<[string]>('INSERT INTO forge_card (reference) VALUES (?)')
  const linkStory = db.prepare<[number, number]>(
    'INSERT INTO forge_card_story (forge_card_id, story_id) VALUES (?, ?)',
  )
  const closeCard = db.prepare<[number]>('UPDATE forge_card SET closed_at = CURRENT_TIMESTAMP WHERE id = ?')
  const updateDispatchProgress = db.prepare<[string, AgentPhase, number]>(
    'UPDATE forge_card SET claude_session_id = ?, current_phase = ? WHERE id = ?',
  )
  const selectStory = db.prepare<[number], StoryLookupRow>('SELECT id, reference, state FROM story WHERE id = ?')
  const selectOpenCardIdForStory = db.prepare<[number], { forge_card_id: number }>(`
    SELECT fcs.forge_card_id AS forge_card_id
    FROM forge_card_story fcs
    JOIN forge_card fc ON fc.id = fcs.forge_card_id
    WHERE fcs.story_id = ? AND fc.closed_at IS NULL
  `)
  const selectCard = db.prepare<[number], ForgeCardRow>(
    'SELECT id, reference, claude_session_id, current_phase, created_at, closed_at FROM forge_card WHERE id = ?',
  )
  const selectStoryIdsOfCard = db.prepare<[number], { story_id: number }>(
    'SELECT story_id FROM forge_card_story WHERE forge_card_id = ? ORDER BY story_id',
  )

  function hydrate(row: ForgeCardRow): ForgeCard {
    return {
      id: row.id,
      reference: row.reference,
      storyIds: selectStoryIdsOfCard.all(row.id).map((link) => link.story_id),
      claudeSessionId: row.claude_session_id,
      currentPhase: row.current_phase,
      createdAt: row.created_at,
      closedAt: row.closed_at,
    }
  }

  function findCard(forgeCardId: number): ForgeCard {
    const row = selectCard.get(forgeCardId)
    if (row === undefined) {
      throw new RangeError(`forge card ${forgeCardId} introuvable`)
    }
    return hydrate(row)
  }

  return {
    createForgeCard: (draft) => {
      const refusal = refusalOfSelection(draft.storyIds)
      if (refusal !== null) {
        if (refusal.reason === 'EmptySelection') {
          throw new EmptySelectionError()
        }
        throw new DuplicateStoryIdError(refusal.storyId)
      }
      for (const storyId of draft.storyIds) {
        const story = selectStory.get(storyId)
        if (story === undefined) {
          throw new ForgeStoryNotFoundError(storyId)
        }
        if (story.state !== 'backlog') {
          throw new StoryNotInBacklogError(story.reference, story.state)
        }
        const openLink = selectOpenCardIdForStory.get(storyId)
        if (openLink !== undefined) {
          const openCard = findCard(openLink.forge_card_id)
          throw new StoryAlreadyOnOpenCardError(story.reference, openCard.reference)
        }
      }
      const reference = `FORGE-${(countCards.get()?.total ?? 0) + 1}`
      const info = insertCard.run(reference)
      const forgeCardId = Number(info.lastInsertRowid)
      for (const storyId of draft.storyIds) {
        linkStory.run(forgeCardId, storyId)
      }
      return findCard(forgeCardId)
    },

    closeForgeCard: (forgeCardId) => {
      closeCard.run(forgeCardId)
    },

    openCardOfStory: (storyId) => {
      const link = selectOpenCardIdForStory.get(storyId)
      return link === undefined ? null : findCard(link.forge_card_id)
    },

    findForgeCard: (forgeCardId) => {
      const row = selectCard.get(forgeCardId)
      if (row === undefined) {
        throw new ForgeCardNotFoundError(forgeCardId)
      }
      return hydrate(row)
    },

    recordDispatch: (forgeCardId, progress) => {
      const existing = selectCard.get(forgeCardId)
      if (existing === undefined) {
        throw new ForgeCardNotFoundError(forgeCardId)
      }
      updateDispatchProgress.run(progress.claudeSessionId, progress.phase, forgeCardId)
      return findCard(forgeCardId)
    },
  }
}
