import type { ForgeCard, ForgeCardDraft, ForgeCardProvider } from '../../../../contract/ForgeCardContract.js'
import { DEFAULT_FORGE_CARD_PROVIDER } from '../../../../contract/ForgeCardContract.js'
import { refusalOfProvider, refusalOfSelection } from './ForgeCard.js'
import type { ForgeCardStatements, ForgeCardRow } from './ForgeCardStatements.js'
import {
  DuplicateStoryIdError,
  EmptySelectionError,
  ForgeStoryNotFoundError,
  StoryAlreadyOnOpenCardError,
  StoryNotInBacklogError,
  UnknownForgeCardProviderError,
  UnknownWorkflowForStoryError,
} from './ForgeCardViolation.js'

export function createForgeCardAdmission({
  selectStory,
  selectOpenCardIdForStory,
  selectCard,
  selectStoryIdsOfCard,
  selectProjectOfStory,
  selectProjectOfWorkflow,
  updateStoryWorkflow,
}: ForgeCardStatements) {
  function hydrate(row: ForgeCardRow): ForgeCard {
    return {
      id: row.id,
      reference: row.reference,
      storyIds: selectStoryIdsOfCard.all(row.id).map((link) => link.story_id),
      provider: row.provider,
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

  function refuseUnknownWorkflow(storyId: number, reference: string, workflowId: number | undefined): void {
    if (workflowId === undefined) {
      return
    }
    const workflowProject = selectProjectOfWorkflow.get(workflowId)?.project_id
    if (workflowProject === undefined || workflowProject !== selectProjectOfStory.get(storyId)?.project_id) {
      throw new UnknownWorkflowForStoryError(workflowId, reference)
    }
  }

  function assignWorkflow(storyId: number, workflowId: number | undefined): void {
    if (workflowId !== undefined) {
      updateStoryWorkflow.run(workflowId, storyId)
    }
  }

  function admit(draft: ForgeCardDraft): ForgeCardProvider {
    const refusal = refusalOfSelection(draft.storyIds)
    if (refusal !== null) {
      if (refusal.reason === 'EmptySelection') {
        throw new EmptySelectionError()
      }
      throw new DuplicateStoryIdError(refusal.storyId)
    }
    const provider = draft.provider ?? DEFAULT_FORGE_CARD_PROVIDER
    const providerRefusal = refusalOfProvider(provider)
    if (providerRefusal !== null) {
      throw new UnknownForgeCardProviderError(providerRefusal.provider)
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
        throw new StoryAlreadyOnOpenCardError(story.reference, findCard(openLink.forge_card_id).reference)
      }
      refuseUnknownWorkflow(storyId, story.reference, draft.workflowId)
    }
    return provider
  }

  return { hydrate, findCard, refuseUnknownWorkflow, assignWorkflow, admit }
}
