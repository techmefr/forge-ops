import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import type { StoryThread } from '@contract/ConversationContract'
import { board } from '@/technical/Api/Board'
import { openBoardStream, type StreamedEvent } from '@/technical/Api/BoardStream'
import { phrase, type Phrase } from '@/technical/Language/Phrase'
import {
  concernsStory,
  foldEvent,
  itemsOfThread,
  withoutPersisted,
  type ReplyRoute,
  type ThreadItem,
} from './ConversationRule'

const liveByStory = new Map<string, readonly ThreadItem[]>()

const SETTLING_EVENTS: readonly string[] = ['session.result', 'session.failed', 'session.dispatched']

export type ConversationStory = { id: number; reference: string }

export type CardConversationOptions = {
  onSettled: () => void
}

export function useCardConversation(story: ConversationStory, { onSettled }: CardConversationOptions) {
  const history = shallowRef<readonly ThreadItem[]>([])
  const live = shallowRef<readonly ThreadItem[]>(liveByStory.get(story.reference) ?? [])
  const failure = ref<Phrase | null>(null)
  const pending = ref(false)
  const sending = ref(false)
  const announcement = ref('')

  const items = computed(() => [...history.value, ...live.value])

  async function load(): Promise<void> {
    pending.value = true
    try {
      history.value = itemsOfThread(await board.read<StoryThread>(`/api/stories/${story.id}/thread`))
      live.value = withoutPersisted(live.value, history.value)
      liveByStory.set(story.reference, live.value)
    } catch {
      failure.value = phrase('common.boardSilent')
    } finally {
      pending.value = false
    }
  }

  function take(event: StreamedEvent): void {
    if (!concernsStory(event.payload.reference, story.reference)) {
      return
    }
    const before = live.value
    const next = foldEvent(before, event, story.reference)
    if (next !== before) {
      live.value = next
      liveByStory.set(story.reference, next)
      const last = next[next.length - 1]
      if (last?.kind === 'message' && last.voice === 'agent') {
        announcement.value = last.body.slice(0, 200)
      }
    }
    if (SETTLING_EVENTS.includes(event.name)) {
      onSettled()
    }
  }

  const handle = openBoardStream({ onEvent: take })
  onScopeDispose(() => handle.close())

  async function send(text: string, route: ReplyRoute): Promise<boolean> {
    const body = text.trim()
    if (body === '' || sending.value) {
      return false
    }
    sending.value = true
    failure.value = null
    try {
      if (route === 'note') {
        await board.send(`/api/stories/${story.id}/discussion`, 'POST', { body })
        await load()
      } else {
        await board.send(`/api/stories/${story.id}/talk`, 'POST', { message: body })
      }
      return true
    } catch {
      failure.value = phrase('forge.drawer.sendFailed')
      return false
    } finally {
      sending.value = false
    }
  }

  return { items, failure, pending, sending, announcement, load, send }
}
