import { ref, shallowRef, type Ref } from 'vue'
import type { ProjectWorkflows, Workflow } from '@contract/WorkflowContract'
import { board } from '@/technical/Api/Board'
import type { Phrase } from '@/technical/Language/Phrase'
import { failureOf } from './WorkflowRule'

export type ProjectWorkflowsState = {
  workflows: Ref<readonly Workflow[]>
  failure: Ref<Phrase | null>
  busy: Ref<boolean>
  load: () => Promise<void>
  create: (name: string) => Promise<Workflow | null>
  rename: (workflowId: number, name: string) => Promise<boolean>
  duplicate: (workflowId: number, name: string) => Promise<Workflow | null>
  remove: (workflowId: number) => Promise<boolean>
}

export function useProjectWorkflows(projectId: () => number): ProjectWorkflowsState {
  const workflows = shallowRef<readonly Workflow[]>([])
  const failure = ref<Phrase | null>(null)
  const busy = ref(false)

  function path(suffix = ''): string {
    return `/api/projects/${projectId()}/workflows${suffix}`
  }

  async function load(): Promise<void> {
    try {
      workflows.value = (await board.read<ProjectWorkflows>(path())).workflows
    } catch (error) {
      failure.value = failureOf(error)
    }
  }

  async function write<T>(action: () => Promise<T>): Promise<T | null> {
    busy.value = true
    failure.value = null
    let result: T | null = null
    try {
      result = await action()
    } catch (error) {
      failure.value = failureOf(error)
    }
    await load()
    busy.value = false
    return result
  }

  return {
    workflows,
    failure,
    busy,
    load,
    create: async (name) => (await write(() => board.send<{ workflow: Workflow }>(path(), 'POST', { name })))?.workflow ?? null,
    rename: async (workflowId, name) =>
      (await write(() => board.send(path(`/${workflowId}`), 'PUT', { name }))) !== null,
    duplicate: async (workflowId, name) =>
      (await write(() => board.send<{ workflow: Workflow }>(path(`/${workflowId}/duplicate`), 'POST', { name })))
        ?.workflow ?? null,
    remove: async (workflowId) => (await write(() => board.send(path(`/${workflowId}`), 'DELETE'))) !== null,
  }
}
