import type { Context } from 'hono'
import { z } from 'zod'
import { assertHandOf } from '../Story/StoryHand.js'
import type { ForgeCardMoved } from '../../../../contract/ForgeCardContract.js'
import type { StoryRepository } from '../Story/StoryRepository.js'
import type { EventBus } from '../../technical/Http/EventBus.js'
import type { ForgeBoardRepository } from './ForgeBoardRepository.js'
import type { ForgeCardCloser } from './ForgeCardCloser.js'
import type { ForgeCardMover } from './ForgeCardMover.js'
import type { ForgeCardRepository } from './ForgeCardRepository.js'

export const identifierSchema = z.coerce.number().int().positive()

export const moveSchema = z.object({ stepKey: z.string().trim().min(1).max(80) }).strict()

export const launchSchema = z.object({ feedback: z.string().trim().min(1).max(4000).optional() }).strict()

export const backlogSchema = z
  .object({
    subjectId: z.number().int().positive(),
    title: z.string().trim().min(1).max(200),
    workflowId: z.number().int().positive().optional(),
  })
  .strict()

export type ForgeBoardApiInput = {
  board: ForgeBoardRepository
  mover: ForgeCardMover
  closer: ForgeCardCloser
  forgeCards: ForgeCardRepository
  stories: StoryRepository
  events: Pick<EventBus, 'publish'>
  autopilot?: {
    reset: (forgeCardId: number) => void
    suspend: (forgeCardId: number) => () => void
    resume: (forgeCardId: number) => Promise<boolean>
  }
}

export function createForgeBoardSupport({ stories, events }: Pick<ForgeBoardApiInput, 'stories' | 'events'>) {
  return {
    assertHand: (context: Context, subjectId: number, reference: string): void => {
      assertHandOf(context, reference, stories.assigneeOf(subjectId))
    },

    announce: (moved: ForgeCardMoved): void => {
      if (!moved.started || moved.claudeSessionId === null) {
        return
      }
      events.publish({
        name: 'session.dispatched',
        payload: {
          storyId: moved.card.storyId,
          reference: moved.card.storyReference,
          claudeSessionId: moved.claudeSessionId,
        },
      })
    },
  }
}
