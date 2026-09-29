import type { Dispatcher } from './Dispatcher.js'
import type { Dispatched, StepEntry } from './Dispatch.js'
import { UnknownStepError } from './DispatchViolation.js'
import type { WorkflowColumnRepository } from '../Workflow/WorkflowColumnRepository.js'

export type StepEntryInput = {
  dispatcher: Dispatcher
  columns: WorkflowColumnRepository
}

export function createStepEntry({
  dispatcher,
  columns,
}: StepEntryInput): (entry: StepEntry) => Promise<Dispatched | null> {
  return async ({ storyId, columnId, phase }) => {
    const column = columns.find(columnId)
    if (column === null) {
      throw new UnknownStepError(columnId)
    }
    if (column.provider === 'human' || !column.autoStart) {
      return null
    }
    return dispatcher.dispatch({ storyId, phase, columnId })
  }
}
