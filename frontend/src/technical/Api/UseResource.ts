import { ref, shallowRef, type Ref } from 'vue'
import { BoardRequestError } from './BoardClient.js'
import { phrase, verbatim, type Phrase } from '../Language/Phrase.js'

export type Resource<T> = {
  data: Ref<T | null>
  failure: Ref<Phrase | null>
  pending: Ref<boolean>
  reload: () => Promise<void>
}

export function reasonOf(error: unknown): Phrase {
  if (error instanceof BoardRequestError || error instanceof Error) {
    return verbatim(error.message)
  }
  return phrase('common.boardSilent')
}

export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const data = shallowRef<T | null>(null)
  const failure = ref<Phrase | null>(null)
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
