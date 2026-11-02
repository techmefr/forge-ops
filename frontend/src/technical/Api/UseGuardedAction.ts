import { ref, type Ref } from 'vue'
import type { Phrase } from '../Language/Phrase.js'
import { reasonOf } from './UseResource.js'

export type GuardedAction = {
  busy: Ref<boolean>
  refusal: Ref<Phrase | null>
  guard: (action: () => Promise<unknown>) => Promise<void>
  attempt: (action: () => Promise<unknown>) => Promise<boolean>
}

export function useGuardedAction(afterSuccess?: () => unknown): GuardedAction {
  const busy = ref(false)
  const refusal = ref<Phrase | null>(null)

  async function attempt(action: () => Promise<unknown>): Promise<boolean> {
    busy.value = true
    refusal.value = null
    try {
      await action()
      await afterSuccess?.()
      return true
    } catch (error) {
      refusal.value = reasonOf(error)
      return false
    } finally {
      busy.value = false
    }
  }

  async function guard(action: () => Promise<unknown>): Promise<void> {
    await attempt(action)
  }

  return { busy, refusal, guard, attempt }
}
