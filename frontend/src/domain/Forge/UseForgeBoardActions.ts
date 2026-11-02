import type { Ref } from 'vue'
import type { ForgeCardMoved, ForgeCardView } from '@contract/ForgeCardContract'
import { board } from '@/technical/Api/Board'
import { BoardRequestError } from '@/technical/Api/BoardClient'
import { phrase, type Phrase } from '@/technical/Language/Phrase'
import { forgeFailureOf } from './ForgeFailure'
import { gapCodesOf } from './ForgeRule'

type ActionState = {
  busy: Ref<ReadonlySet<number>>
  failure: Ref<Phrase | null>
  gaps: Ref<readonly Phrase[]>
  refresh: () => Promise<void>
}

export function createForgeBoardActions({ busy, failure, gaps, refresh }: ActionState) {
  function markBusy(cardId: number, on: boolean): void {
    const next = new Set(busy.value)
    if (on) {
      next.add(cardId)
    } else {
      next.delete(cardId)
    }
    busy.value = next
  }

  async function act<T>(card: ForgeCardView, path: string, body: unknown): Promise<T | null> {
    if (busy.value.has(card.id)) {
      return null
    }
    markBusy(card.id, true)
    failure.value = null
    gaps.value = []
    let moved: T | null = null
    try {
      moved = await board.send<T>(path, 'POST', body)
    } catch (error) {
      failure.value = forgeFailureOf(error)
      if (error instanceof BoardRequestError) {
        gaps.value = gapCodesOf(error.detail).map((code) => phrase(`storyGap.${code}`))
      }
    }
    try {
      await refresh()
    } catch (error) {
      failure.value ??= forgeFailureOf(error)
    }
    markBusy(card.id, false)
    return moved
  }

  return {
    move: (card: ForgeCardView, stepKey: string) =>
      act<ForgeCardMoved>(card, `/api/forge-cards/${card.id}/move`, { stepKey }),
    launch: (card: ForgeCardView) => act<ForgeCardMoved>(card, `/api/forge-cards/${card.id}/launch`, {}),
    finish: async (card: ForgeCardView) => (await act<unknown>(card, `/api/forge-cards/${card.id}/done`, {})) !== null,

    stop: async (card: ForgeCardView): Promise<void> => {
      if (busy.value.has(card.id)) {
        return
      }
      markBusy(card.id, true)
      failure.value = null
      try {
        await board.send(`/api/stories/${card.storyId}/talk`, 'DELETE')
      } catch {
        failure.value = phrase('forge.drawer.stopFailed')
      }
      try {
        await refresh()
      } catch (error) {
        failure.value ??= forgeFailureOf(error)
      }
      markBusy(card.id, false)
    },

    addStory: async (subjectId: number, title: string, workflowId?: number): Promise<boolean> => {
      failure.value = null
      try {
        await board.send('/api/forge-cards/backlog', 'POST', { subjectId, title, ...(workflowId === undefined ? {} : { workflowId }) })
        await refresh()
        return true
      } catch (error) {
        failure.value = forgeFailureOf(error)
        return false
      }
    },
  }
}
