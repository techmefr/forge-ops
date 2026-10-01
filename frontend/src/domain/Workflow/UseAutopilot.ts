import { ref, shallowRef, type Ref } from 'vue'
import type { AutopilotSettings, ProjectAutopilot } from '@contract/AutopilotContract'
import { board } from '@/technical/Api/Board'
import type { Phrase } from '@/technical/Language/Phrase'
import { failureOf } from './WorkflowRule'

export type AutopilotState = {
  autopilot: Ref<ProjectAutopilot | null>
  failure: Ref<Phrase | null>
  busy: Ref<boolean>
  load: () => Promise<void>
  settle: (settings: AutopilotSettings) => Promise<boolean>
}

export function useAutopilot(projectId: () => number): AutopilotState {
  const autopilot = shallowRef<ProjectAutopilot | null>(null)
  const failure = ref<Phrase | null>(null)
  const busy = ref(false)

  function path(): string {
    return `/api/projects/${projectId()}/autopilot`
  }

  async function load(): Promise<void> {
    failure.value = null
    try {
      autopilot.value = await board.read<ProjectAutopilot>(path())
    } catch (error) {
      failure.value = failureOf(error)
    }
  }

  async function settle(settings: AutopilotSettings): Promise<boolean> {
    busy.value = true
    failure.value = null
    let succeeded = true
    try {
      await board.send(path(), 'PUT', settings)
    } catch (error) {
      failure.value = failureOf(error)
      succeeded = false
    }
    await load()
    busy.value = false
    return succeeded
  }

  return { autopilot, failure, busy, load, settle }
}

export function settingsOf(autopilot: ProjectAutopilot): AutopilotSettings {
  return {
    enabled: autopilot.enabled,
    autoLaunch: autopilot.autoLaunch,
    autoPublish: autopilot.autoPublish,
    autoMerge: autopilot.autoMerge,
  }
}
