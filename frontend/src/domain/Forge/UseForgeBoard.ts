import { ref, shallowRef, type Ref } from 'vue'
import type { ForgeCardMoved, ForgeCardView } from '@contract/ForgeCardContract'
import type { EpicOverview } from '@contract/StoryContract'
import type { ProjectWorkflow } from '@contract/WorkflowColumnContract'
import { board } from '@/technical/Api/Board'
import { BoardRequestError } from '@/technical/Api/BoardClient'
import { reasonOf } from '@/technical/Api/UseResource'
import { phrase, type Phrase } from '@/technical/Language/Phrase'
import { FORGE_FAILURE_CODES } from './ForgeRule'

export function forgeFailureOf(error: unknown): Phrase {
  if (error instanceof BoardRequestError && (FORGE_FAILURE_CODES as readonly string[]).includes(error.code)) {
    return phrase(`forge.failure.${error.code}`)
  }
  return reasonOf(error)
}

export type ForgeBoardState = {
  cards: Ref<readonly ForgeCardView[]>
  workflow: Ref<ProjectWorkflow | null>
  subjects: Ref<readonly EpicOverview[]>
  failure: Ref<Phrase | null>
  pending: Ref<boolean>
  busy: Ref<ReadonlySet<number>>
  load: () => Promise<void>
  refresh: () => Promise<void>
  move: (card: ForgeCardView, stepKey: string) => Promise<ForgeCardMoved | null>
  launch: (card: ForgeCardView) => Promise<ForgeCardMoved | null>
  stop: (card: ForgeCardView) => Promise<void>
  addStory: (subjectId: number, title: string) => Promise<boolean>
}

export function useForgeBoard(projectId: () => number | null): ForgeBoardState {
  const cards = shallowRef<readonly ForgeCardView[]>([])
  const workflow = shallowRef<ProjectWorkflow | null>(null)
  const subjects = shallowRef<readonly EpicOverview[]>([])
  const failure = ref<Phrase | null>(null)
  const pending = ref(false)
  const busy = ref<ReadonlySet<number>>(new Set())

  async function refresh(): Promise<void> {
    const project = projectId()
    if (project === null) {
      cards.value = []
      return
    }
    cards.value = await board.read<readonly ForgeCardView[]>(`/api/forge-cards?project=${project}`)
  }

  async function load(): Promise<void> {
    const project = projectId()
    if (project === null) {
      cards.value = []
      workflow.value = null
      subjects.value = []
      return
    }
    pending.value = true
    failure.value = null
    try {
      const [loadedWorkflow, loadedSubjects] = await Promise.all([
        board.read<ProjectWorkflow>(`/api/projects/${project}/workflow-columns`),
        board.read<readonly EpicOverview[]>(`/api/projects/${project}/epics`),
      ])
      workflow.value = loadedWorkflow
      subjects.value = loadedSubjects
      await refresh()
    } catch (error) {
      failure.value = forgeFailureOf(error)
    } finally {
      pending.value = false
    }
  }

  function markBusy(cardId: number, on: boolean): void {
    const next = new Set(busy.value)
    if (on) {
      next.add(cardId)
    } else {
      next.delete(cardId)
    }
    busy.value = next
  }

  async function act(card: ForgeCardView, path: string, body: unknown): Promise<ForgeCardMoved | null> {
    if (busy.value.has(card.id)) {
      return null
    }
    markBusy(card.id, true)
    failure.value = null
    let moved: ForgeCardMoved | null = null
    try {
      moved = await board.send<ForgeCardMoved>(path, 'POST', body)
    } catch (error) {
      failure.value = forgeFailureOf(error)
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
    cards,
    workflow,
    subjects,
    failure,
    pending,
    busy,
    load,
    refresh,
    move: (card, stepKey) => act(card, `/api/forge-cards/${card.id}/move`, { stepKey }),
    launch: (card) => act(card, `/api/forge-cards/${card.id}/launch`, {}),
    stop: async (card) => {
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
    addStory: async (subjectId, title) => {
      failure.value = null
      try {
        await board.send('/api/forge-cards/backlog', 'POST', { subjectId, title })
        await refresh()
        return true
      } catch (error) {
        failure.value = forgeFailureOf(error)
        return false
      }
    },
  }
}
