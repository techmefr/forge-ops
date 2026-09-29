import { ref, shallowRef, type Ref } from 'vue'
import { BoardRequestError } from './BoardClient.js'
import { phrase, verbatim, type Phrase } from '../Language/Phrase.js'

export type Resource<T> = {
  data: Ref<T | null>
  failure: Ref<Phrase | null>
  pending: Ref<boolean>
  reload: () => Promise<void>
}

export const SERVER_ERROR_CODES = [
  'UnexpectedError',
  'StoryNotFoundError',
  'EpicNotFoundError',
  'EventNotFoundError',
  'RiskNotFoundError',
  'TagNotFoundError',
  'ItemInUseError',
  'ScopeTakenError',
  'InvalidRequest',
  'StoryNotYoursError',
  'EpicTakenError',
  'ProjectAdminRequired',
  'WorkflowNeedsTheProjectAdmin',
  'SuperAdminRequired',
  'DirectorRequired',
  'UnauthenticatedAccount',
  'TooManyLoginAttempts',
  'LoginRefusedError',
  'AccountDisabledError',
  'LoginTakenError',
  'LastSuperAdminError',
  'UnknownAccountError',
  'PasswordRefusedError',
  'DoneNotEarnedError',
  'ProjectNotFoundError',
] as const

export function reasonOf(error: unknown): Phrase {
  if (error instanceof BoardRequestError && (SERVER_ERROR_CODES as readonly string[]).includes(error.code)) {
    return phrase(`serverError.${error.code}`)
  }
  if (error instanceof BoardRequestError && error.code.startsWith('Invalid')) {
    return phrase('serverError.InvalidRequest')
  }
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
