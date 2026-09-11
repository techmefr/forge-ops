import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { board } from '@/technical/Api/Board'
import { writePreference } from '@/technical/Appearance/Preference'
import {
  FIRST_TOUR_MEMORY,
  clampIndex,
  isFirstStep,
  isLastStep,
  nextIndex,
  previousIndex,
  readMemory,
  shouldOpen,
  stepAt,
  tourLength,
  writeMemory,
  type TourMemory,
} from './TourWalk'
import type { TourStep } from './TourStep'

export const TOUR_STORAGE_KEY = 'forge.tour'

export const TOUR_OPT_IN_KEY = 'forge.tour.optIn'

export type BoardEnvironment = 'demo' | 'real'

export type TourDesk = {
  open: Ref<boolean>
  index: Ref<number>
  total: number
  environment: Ref<BoardEnvironment>
  step: ComputedRef<TourStep | null>
  first: ComputedRef<boolean>
  last: ComputedRef<boolean>
  offered: ComputedRef<boolean>
  awake: () => Promise<void>
  goNext: () => void
  goBack: () => void
  reopen: () => void
  dismiss: () => void
}

function storedMemory(): TourMemory {
  try {
    return readMemory(window.localStorage.getItem(TOUR_STORAGE_KEY))
  } catch {
    return FIRST_TOUR_MEMORY
  }
}

function storedOptIn(): boolean {
  try {
    return window.localStorage.getItem(TOUR_OPT_IN_KEY) === 'on'
  } catch {
    return false
  }
}

export function useTour(): TourDesk {
  const open = ref(false)
  const index = ref(0)
  const environment = ref<BoardEnvironment>('real')
  const optIn = ref(false)

  function remember(state: TourMemory['state']): void {
    writePreference(TOUR_STORAGE_KEY, writeMemory({ state, index: index.value }))
  }

  async function awake(): Promise<void> {
    const memory = storedMemory()
    index.value = memory.index
    try {
      const answer = await board.read<{ environment?: BoardEnvironment }>('/api/board/mode')
      environment.value = answer.environment === 'demo' ? 'demo' : 'real'
    } catch {
      environment.value = 'real'
    }
    optIn.value = storedOptIn()
    open.value = shouldOpen({ environment: environment.value, optIn: optIn.value, memory })
    if (open.value) {
      remember('running')
    }
  }

  return {
    open,
    index,
    total: tourLength(),
    environment,
    step: computed(() => (open.value ? stepAt(index.value) : null)),
    first: computed(() => isFirstStep(index.value)),
    last: computed(() => isLastStep(index.value)),
    offered: computed(() => !open.value && (environment.value === 'demo' || optIn.value)),
    awake,

    goNext: () => {
      if (isLastStep(index.value)) {
        open.value = false
        remember('closed')
        return
      }
      index.value = nextIndex(index.value)
      remember('running')
    },

    goBack: () => {
      index.value = previousIndex(index.value)
      remember('running')
    },

    reopen: () => {
      index.value = clampIndex(index.value)
      open.value = true
      remember('running')
    },

    dismiss: () => {
      open.value = false
      remember('closed')
    },
  }
}
