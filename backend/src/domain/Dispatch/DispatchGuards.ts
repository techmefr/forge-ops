import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import type { ForemergeRepository } from '../Foremerge/ForemergeRepository.js'
import { ScopeTakenError } from '../Foremerge/ForemergeViolation.js'
import { collisionsBetween } from '../Foremerge/Scope.js'
import type { ForgeCardRepository } from '../ForgeCard/ForgeCardRepository.js'
import { scoreCompleteness } from '../Story/Completeness.js'
import type { Story } from '../Story/Story.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { DispatchOrder, PhaseContract } from './Dispatch.js'
import { BUSY_LIFECYCLES, type DispatchStatements } from './DispatchStatements.js'
import {
  PhaseNotReadyError,
  SessionAlreadyRunningError,
  StoryBlockedError,
  StoryTooThinError,
} from './DispatchViolation.js'

export type OpenCard = NonNullable<ReturnType<ForgeCardRepository['openCardOfStory']>>

export type CardClaim = {
  forgeCard: OpenCard | null
  waitingOnCard: readonly string[]
}

type GuardsInput = {
  stories: StoryRepository
  checkpoints: CheckpointRepository
  criteria: CriterionRepository
  foremerge: ForemergeRepository
  forgeCards: ForgeCardRepository
  statements: DispatchStatements
}

export function createDispatchGuards({ stories, checkpoints, criteria, foremerge, forgeCards, statements }: GuardsInput) {
  const { countBusyOnStory, selectWaitingOnStory, selectBlockers } = statements

  function assertReady(order: DispatchOrder, story: Story, contract: PhaseContract): void {
    if (order.phase !== 'spec') {
      const verdict = scoreCompleteness({
        title: story.title,
        body: story.body,
        criteria: criteria.listCriteria(order.storyId).map((criterion) => criterion.reference),
        hasTwin: stories.findTwin(order.storyId) !== null,
      })
      if (!verdict.launchable) {
        throw new StoryTooThinError(story.reference, verdict.score, verdict.gaps, verdict.gapCodes)
      }
    }
    const blockers = selectBlockers.all(order.storyId).map((row) => row.reference)
    if (blockers.length > 0) {
      throw new StoryBlockedError(story.reference, blockers)
    }
    const proven = checkpoints
      .definitionOfDone(order.storyId)
      .filter((step) => step.proven)
      .map((step) => step.name)
    const missing = order.columnId === undefined ? contract.requires.filter((name) => !proven.includes(name)) : []
    if (missing.length > 0) {
      throw new PhaseNotReadyError(order.phase, missing)
    }
  }

  function claimCard(order: DispatchOrder, story: Story): CardClaim {
    const forgeCard = forgeCards.openCardOfStory(order.storyId)
    const cardStoryIds = forgeCard === null ? [order.storyId] : forgeCard.storyIds
    const busyOnCard = cardStoryIds.reduce(
      (total, cardStoryId) => total + (countBusyOnStory.get(cardStoryId, ...BUSY_LIFECYCLES)?.total ?? 0),
      0,
    )
    if (busyOnCard > 0) {
      throw new SessionAlreadyRunningError(story.reference, order.phase)
    }
    const waitingOnCard = cardStoryIds.flatMap((cardStoryId) =>
      selectWaitingOnStory.all(cardStoryId).map((row) => row.claude_session_id),
    )
    return { forgeCard, waitingOnCard }
  }

  function assertScopeFree(order: DispatchOrder): void {
    if (order.phase === 'spec') {
      return
    }
    const held = foremerge.listReservations()
    const mine = held.filter((reservation) => reservation.storyId === order.storyId)
    for (const claim of mine) {
      for (const other of held) {
        const collision = collisionsBetween([claim, other])[0]
        if (collision !== undefined) {
          throw new ScopeTakenError(claim.pathPrefix, other.storyReference, other.reservedAt, collision.reason)
        }
      }
    }
  }

  return { assertReady, claimCard, assertScopeFree }
}
