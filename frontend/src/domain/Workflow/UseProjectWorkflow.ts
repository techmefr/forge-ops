import { ref, shallowRef, type Ref } from 'vue'
import type { ProjectWorkflow, WorkflowColumnDraft } from '@contract/WorkflowColumnContract'
import { board } from '@/technical/Api/Board'
import type { Phrase } from '@/technical/Language/Phrase'
import { failureOf } from './WorkflowRule'

export type ProjectWorkflowState = {
  workflow: Ref<ProjectWorkflow | null>
  failure: Ref<Phrase | null>
  pending: Ref<boolean>
  busy: Ref<boolean>
  load: () => Promise<void>
  create: (draft: WorkflowColumnDraft) => Promise<boolean>
  createMany: (drafts: readonly WorkflowColumnDraft[]) => Promise<boolean>
  update: (columnId: number, draft: WorkflowColumnDraft) => Promise<boolean>
  remove: (columnId: number) => Promise<boolean>
  reorder: (keysInOrder: readonly string[]) => Promise<boolean>
}

export function useProjectWorkflow(projectId: () => number): ProjectWorkflowState {
  const workflow = shallowRef<ProjectWorkflow | null>(null)
  const failure = ref<Phrase | null>(null)
  const pending = ref(false)
  const busy = ref(false)

  function path(suffix = ''): string {
    return `/api/projects/${projectId()}/workflow-columns${suffix}`
  }

  async function load(): Promise<void> {
    pending.value = true
    failure.value = null
    try {
      workflow.value = await board.read<ProjectWorkflow>(path())
    } catch (error) {
      failure.value = failureOf(error)
    } finally {
      pending.value = false
    }
  }

  async function write(action: () => Promise<unknown>): Promise<boolean> {
    busy.value = true
    failure.value = null
    let succeeded = true
    try {
      await action()
    } catch (error) {
      failure.value = failureOf(error)
      succeeded = false
    }
    try {
      workflow.value = await board.read<ProjectWorkflow>(path())
    } catch (error) {
      failure.value ??= failureOf(error)
    }
    busy.value = false
    return succeeded
  }

  return {
    workflow,
    failure,
    pending,
    busy,
    load,
    create: (draft) => write(() => board.send(path(), 'POST', draft)),
    createMany: (drafts) =>
      write(async () => {
        for (const draft of drafts) {
          await board.send(path(), 'POST', draft)
        }
      }),
    update: (columnId, draft) => write(() => board.send(path(`/${columnId}`), 'PUT', draft)),
    remove: (columnId) => write(() => board.send(path(`/${columnId}`), 'DELETE')),
    reorder: (keysInOrder) => write(() => board.send(path('/order'), 'PUT', { keysInOrder })),
  }
}
