import { BoardRequestError } from '@/technical/Api/BoardClient'
import { reasonOf } from '@/technical/Api/UseResource'
import { phrase, type Phrase } from '@/technical/Language/Phrase'
import { FORGE_FAILURE_CODES } from './ForgeRule'

export function forgeFailureOf(error: unknown): Phrase {
  if (error instanceof BoardRequestError && (FORGE_FAILURE_CODES as readonly string[]).includes(error.code)) {
    return phrase(`forge.failure.${error.code}`)
  }
  return reasonOf(error)
}
