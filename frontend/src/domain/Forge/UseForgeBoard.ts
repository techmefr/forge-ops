import { ref, shallowRef, type Ref } from 'vue'
import type { ForgeCardMoved, ForgeCardView } from '@contract/ForgeCardContract'
import type { EpicOverview } from '@contract/StoryContract'
import type { ProjectWorkflow, WorkflowColumn } from '@contract/WorkflowColumnContract'
import type { ProjectWorkflows, Workflow } from '@contract/WorkflowContract'
import { board } from '@/technical/Api/Board'
import { BoardRequestError } from '@/technical/Api/BoardClient'
import { reasonOf } from '@/technical/Api/UseResource'
import { phrase, type Phrase } from '@/technical/Language/Phrase'
import { FORGE_FAILURE_CODES, gapCodesOf } from './ForgeRule'

export function forgeFailureOf(error: unknown): Phrase {
  if (error instanceof BoardRequestError && (FORGE_FAILURE_CODES as readonly string[]).includes(error.code)) {
    return phrase(`forge.failure.${error.code}`)
  }
  return reasonOf(error)
}

export type ForgeBoardState = {
  cards: Ref<readonly ForgeCardView[]>
  workflow: Ref<ProjectWorkflow | null>
  workflows: Ref<readonly Workflow[]>
  columnsOf: (workflowId: number) => readonly WorkflowColumn[]
  subjects: Ref<readonly EpicOverview[]>
  failure: Ref<Phrase | null>
  gaps: Ref<readonly Phrase[]>
  pending: Ref<boolean>
  busy: Ref<ReadonlySet<number>>
  load: () => Promise<void>
  refresh: () => Promise<void>
  move: (card: ForgeCardView, stepKey: string) => Promise<ForgeCardMoved | null>
  launch: (card: ForgeCardView) => Promise<ForgeCardMoved | null>
  finish: (card: ForgeCardView) => Promise<boolean>
  stop: (card: ForgeCardView) => Promise<void>
  addStory: (subjectId: number, title: string, workflowId?: number) => Promise<boolean>
}

export function useForgeBoard(projectId: () => number | null): ForgeBoardState {
  const cards = shallowRef<readonly ForgeCardView[]>([])
  const workflow = shallowRef<ProjectWorkflow | null>(null)
  const workflows = shallowRef<readonly Workflow[]>([])
  const columnsByWorkflow = shallowRef<ReadonlyMap<number, readonly WorkflowColumn[]>>(new Map())
  const subjects = shallowRef<readonly EpicOverview[]>([])
  const failure = ref<Phrase | null>(null)
  const gaps = shallowRef<readonly Phrase[]>([])
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
      workflows.value = []
      columnsByWorkflow.value = new Map()
      subjects.value = []
      return
    }
    pending.value = true
    failure.value = null
    try {
      const [listed, loadedSubjects] = await Promise.all([
        board.read<ProjectWorkflows>(`/api/projects/${project}/workflows`),
        board.read<readonly EpicOverview[]>(`/api/projects/${project}/epics`),
      ])
      const loaded = await Promise.all(
        listed.workflows.map((held) =>
          board.read<ProjectWorkflow>(`/api/projects/${project}/workflow-columns?workflow=${held.id}`),
        ),
      )
      workflow.value = loaded[0] ?? (await board.read<ProjectWorkflow>(`/api/projects/${project}/workflow-columns`))
      workflows.value = listed.workflows
      columnsByWorkflow.value = new Map(listed.workflows.map((held, index) => [held.id, loaded[index]?.columns ?? []]))
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
    cards,
    workflow,
    workflows,
    columnsOf: (workflowId) => columnsByWorkflow.value.get(workflowId) ?? [],
    subjects,
    failure,
    gaps,
    pending,
    busy,
    load,
    refresh,
    move: (card, stepKey) => act<ForgeCardMoved>(card, `/api/forge-cards/${card.id}/move`, { stepKey }),
    launch: (card) => act<ForgeCardMoved>(card, `/api/forge-cards/${card.id}/launch`, {}),
    finish: async (card) => (await act<unknown>(card, `/api/forge-cards/${card.id}/done`, {})) !== null,
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
    addStory: async (subjectId, title, workflowId) => {
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
