import { ref, shallowRef, type Ref } from 'vue'
import { BoardRequestError } from './BoardClient.js'

export type Resource<T> = {
  data: Ref<T | null>
  failure: Ref<string | null>
  pending: Ref<boolean>
  reload: () => Promise<void>
}

export function reasonOf(error: unknown): string {
  if (error instanceof BoardRequestError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Le board n a pas repondu'
}

export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const data = shallowRef<T | null>(null)
  const failure = ref<string | null>(null)
  const pending = ref(false)

  async function reload(): Promise<void> {
    pending.value = true
    failure.value = null
    try {
      data.value = await load()
    } catch (error) {
      failure.value = reasonOf(error)
    } finally {
      pending.value = false
    }
  }

  return { data, failure, pending, reload }
}
