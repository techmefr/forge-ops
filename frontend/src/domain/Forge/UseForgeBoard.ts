import { ref, shallowRef, type Ref } from 'vue'
import type { ForgeCardMoved, ForgeCardView } from '@contract/ForgeCardContract'
import type { EpicOverview } from '@contract/StoryContract'
import type { ProjectWorkflow, WorkflowColumn } from '@contract/WorkflowColumnContract'
import type { ProjectWorkflows, Workflow } from '@contract/WorkflowContract'
import { board } from '@/technical/Api/Board'
import type { Phrase } from '@/technical/Language/Phrase'
import { forgeFailureOf } from './ForgeFailure'
import { createForgeBoardActions } from './UseForgeBoardActions'

export { forgeFailureOf }

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

async function fetchBoardStructure(project: number) {
  const [listed, loadedSubjects] = await Promise.all([
    board.read<ProjectWorkflows>(`/api/projects/${project}/workflows`),
    board.read<readonly EpicOverview[]>(`/api/projects/${project}/epics`),
  ])
  const loaded = await Promise.all(
    listed.workflows.map((held) =>
      board.read<ProjectWorkflow>(`/api/projects/${project}/workflow-columns?workflow=${held.id}`),
    ),
  )
  const first = loaded[0] ?? (await board.read<ProjectWorkflow>(`/api/projects/${project}/workflow-columns`))
  const columns: ReadonlyMap<number, readonly WorkflowColumn[]> = new Map(
    listed.workflows.map((held, index) => [held.id, loaded[index]?.columns ?? []]),
  )
  return { listed, first, columns, loadedSubjects }
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
    const read = project === null ? [] : await board.read<readonly ForgeCardView[]>(`/api/forge-cards?project=${project}`)
    if (projectId() === project) {
      cards.value = read
    }
  }

  let loading = 0

  async function load(): Promise<void> {
    const project = projectId()
    const mine = ++loading
    if (project === null) {
      cards.value = []
      workflow.value = null
      workflows.value = []
      columnsByWorkflow.value = new Map()
      subjects.value = []
      pending.value = false
      return
    }
    pending.value = true
    failure.value = null
    try {
      const { listed, first, columns, loadedSubjects } = await fetchBoardStructure(project)
      if (mine !== loading) {
        return
      }
      workflow.value = first
      workflows.value = listed.workflows
      columnsByWorkflow.value = columns
      subjects.value = loadedSubjects
      await refresh()
    } catch (error) {
      if (mine === loading) {
        failure.value = forgeFailureOf(error)
      }
    } finally {
      if (mine === loading) {
        pending.value = false
      }
    }
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
    ...createForgeBoardActions({ busy, failure, gaps, refresh }),
  }
}
