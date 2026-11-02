import { BudgetExhaustedError } from '../Budget/BudgetViolation.js'
import {
  CheckoutMissingError,
  DispatchTooFastError,
  FleetSaturatedError,
  SessionAlreadyRunningError,
  StoryBlockedError,
  StoryTooThinError,
} from '../Dispatch/DispatchViolation.js'
import { StepBusyError } from '../ForgeCard/ForgeCardViolation.js'

export const WAITING_BUDGET_REASON = 'Waiting: budget exhausted'

export type Handling = 'wait' | 'budget' | 'red'

export function handlingOf(error: unknown): Handling {
  if (
    error instanceof FleetSaturatedError ||
    error instanceof DispatchTooFastError ||
    error instanceof SessionAlreadyRunningError ||
    error instanceof StepBusyError
  ) {
    return 'wait'
  }
  return error instanceof BudgetExhaustedError ? 'budget' : 'red'
}

export function isLaunchRefusal(error: unknown): boolean {
  return error instanceof StoryTooThinError || error instanceof StoryBlockedError || error instanceof CheckoutMissingError
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
