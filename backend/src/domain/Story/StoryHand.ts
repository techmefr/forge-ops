import type { Context } from 'hono'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import { StoryNotYoursError } from './StoryViolation.js'

declare module 'hono' {
  interface ContextVariableMap {
    handOverride: boolean
  }
}

export function assertStoryHand(reference: string, assignee: string | null, operator: string): void {
  if (assignee !== null && assignee !== operator) {
    throw new StoryNotYoursError(reference, assignee)
  }
}

export function assertHandOf(context: Context, reference: string, assignee: string | null): void {
  if (context.get('handOverride') === true) {
    return
  }
  assertStoryHand(reference, assignee, operatorOf(context))
}

export type EpicAuthorityInput = {
  login: string
  assignee: string | null
  mayAdminister: boolean
}

export function mayActOnEpic({ login, assignee, mayAdminister }: EpicAuthorityInput): boolean {
  return mayAdminister || assignee === null || assignee === login
}
