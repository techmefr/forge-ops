import type Database from 'better-sqlite3'
import type { AgentPhase } from '../../../../contract/AgentContract.js'
import { DEFAULT_FORGE_CARD_PROVIDER, type ForgeCard, type ForgeCardDraft } from '../../../../contract/ForgeCardContract.js'
import { createForgeCardAdmission } from './ForgeCardAdmission.js'
import { prepareForgeCardStatements } from './ForgeCardStatements.js'
import { ForgeCardNotFoundError, ForgeStoryNotFoundError, UnknownWorkflowForStoryError } from './ForgeCardViolation.js'

export type ForgeCardDispatchProgress = {
  claudeSessionId: string
  phase: AgentPhase
}

export type ForgeCardRepository = {
  createForgeCard: (draft: ForgeCardDraft) => ForgeCard
  closeForgeCard: (forgeCardId: number) => void
  openCardOfStory: (storyId: number) => ForgeCard | null
  findForgeCard: (forgeCardId: number) => ForgeCard
  attachCardToStory: (storyId: number, workflowId?: number) => ForgeCard
  assertWorkflowOfProject: (projectId: number, workflowId: number, subject: string) => void
  recordDispatch: (forgeCardId: number, progress: ForgeCardDispatchProgress) => ForgeCard
}

type ForgeCardStatementSet = ReturnType<typeof prepareForgeCardStatements>
type ForgeCardAdmission = ReturnType<typeof createForgeCardAdmission>

function createForgeCardAttacher(
  statements: ForgeCardStatementSet,
  { findCard, refuseUnknownWorkflow, assignWorkflow }: ForgeCardAdmission,
  nextReference: () => string,
): ForgeCardRepository['attachCardToStory'] {
  const { selectStory, selectAnyCardIdForStory, insertCard, linkStory, closeCard } = statements
  return (storyId, workflowId) => {
    const story = selectStory.get(storyId)
    if (story === undefined) {
      throw new ForgeStoryNotFoundError(storyId)
    }
    refuseUnknownWorkflow(storyId, story.reference, workflowId)
    const existing = selectAnyCardIdForStory.get(storyId)
    if (existing !== undefined) {
      assignWorkflow(storyId, workflowId)
      return findCard(existing.forge_card_id)
    }
    const info = insertCard.run(nextReference(), DEFAULT_FORGE_CARD_PROVIDER)
    const forgeCardId = Number(info.lastInsertRowid)
    linkStory.run(forgeCardId, storyId)
    assignWorkflow(storyId, workflowId)
    if (story.state === 'done') {
      closeCard.run(forgeCardId)
    }
    return findCard(forgeCardId)
  }
}

export function createForgeCardRepository(db: Database.Database): ForgeCardRepository {
  const statements = prepareForgeCardStatements(db)
  const {
    countCards,
    insertCard,
    linkStory,
    closeCard,
    updateDispatchProgress,
    selectProjectOfWorkflow,
    selectOpenCardIdForStory,
    selectCard,
  } = statements
  const admission = createForgeCardAdmission(statements)
  const { hydrate, findCard, assignWorkflow, admit } = admission

  function nextReference(): string {
    return `FORGE-${(countCards.get()?.total ?? 0) + 1}`
  }

  const attachCardToStory = createForgeCardAttacher(statements, admission, nextReference)

  return {
    createForgeCard: (draft) => {
      const provider = admit(draft)
      const info = insertCard.run(nextReference(), provider)
      const forgeCardId = Number(info.lastInsertRowid)
      for (const storyId of draft.storyIds) {
        linkStory.run(forgeCardId, storyId)
        assignWorkflow(storyId, draft.workflowId)
      }
      return findCard(forgeCardId)
    },

    assertWorkflowOfProject: (projectId, workflowId, subject) => {
      if (selectProjectOfWorkflow.get(workflowId)?.project_id !== projectId) {
        throw new UnknownWorkflowForStoryError(workflowId, subject)
      }
    },

    closeForgeCard: (forgeCardId) => {
      closeCard.run(forgeCardId)
    },

    attachCardToStory,

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
      if (selectCard.get(forgeCardId) === undefined) {
        throw new ForgeCardNotFoundError(forgeCardId)
      }
      updateDispatchProgress.run(progress.claudeSessionId, progress.phase, forgeCardId)
      return findCard(forgeCardId)
    },
  }
}
