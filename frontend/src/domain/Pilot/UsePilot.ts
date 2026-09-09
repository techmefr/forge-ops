import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import type { PilotPace, PilotRun, PilotSight, PilotStep } from '@/domain/Board/BoardModel'
import { nextStepOf, progressOf, type WalkProgress } from './Walk'

export type PilotDesk = {
  run: Ref<PilotRun | null>
  history: Ref<readonly PilotRun[]>
  sight: Ref<PilotSight | null>
  refusal: Ref<string | null>
  busy: Ref<boolean>
  pace: Ref<PilotPace>
  url: Ref<string>
  script: Ref<PilotStep[]>
  progress: ComputedRef<WalkProgress>
  nextStep: ComputedRef<PilotStep | null>
  load: () => Promise<void>
  addStep: (step: PilotStep) => void
  dropStep: (index: number) => void
  start: () => Promise<void>
  advance: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  inspect: () => Promise<void>
  abandon: () => Promise<void>
}

type Answer = { run: PilotRun | null; history: readonly PilotRun[] }

export function usePilot(storyId: Ref<number | null>): PilotDesk {
  const run = ref<PilotRun | null>(null)
  const history = ref<readonly PilotRun[]>([])
  const sight = ref<PilotSight | null>(null)
  const refusal = ref<string | null>(null)
  const busy = ref(false)
  const pace = ref<PilotPace>('slow')
  const url = ref('')
  const script = ref<PilotStep[]>([])

  async function load(): Promise<void> {
    const target = storyId.value
    if (target === null) {
      run.value = null
      history.value = []
      return
    }
    const answer = await board.read<Answer>(`/api/stories/${target}/pilot`)
    run.value = answer.run
    history.value = answer.history
  }

  async function guard(action: (target: number) => Promise<void>): Promise<void> {
    const target = storyId.value
    if (target === null) {
      return
    }
    busy.value = true
    refusal.value = null
    try {
      await action(target)
    } catch (error) {
      refusal.value = reasonOf(error)
    } finally {
      busy.value = false
    }
  }

  function walk(path: string): Promise<void> {
    return guard(async (target) => {
      run.value = await board.send<PilotRun>(`/api/stories/${target}/pilot${path}`, 'POST')
      await load()
    })
  }

  return {
    run,
    history,
    sight,
    refusal,
    busy,
    pace,
    url,
    script,
    progress: computed(() => progressOf(run.value)),
    nextStep: computed(() => nextStepOf(run.value)),
    load,

    addStep: (step) => {
      script.value = [...script.value, step]
    },

    dropStep: (index) => {
      script.value = script.value.filter((_step, at) => at !== index)
    },

    start: () =>
      guard(async (target) => {
        run.value = await board.send<PilotRun>(`/api/stories/${target}/pilot`, 'POST', {
          url: url.value,
          pace: pace.value,
          script: script.value,
        })
        sight.value = null
        await load()
      }),

    advance: () => walk('/advance'),
    pause: () => walk('/pause'),
    resume: () => walk('/resume'),

    inspect: () =>
      guard(async (target) => {
        sight.value = await board.send<PilotSight>(`/api/stories/${target}/pilot/inspect`, 'POST')
      }),

    abandon: () =>
      guard(async (target) => {
        run.value = await board.send<PilotRun>(`/api/stories/${target}/pilot`, 'DELETE')
        await load()
      }),
  }
}
