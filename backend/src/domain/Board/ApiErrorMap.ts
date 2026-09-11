import type { ErrorHandler } from 'hono'
import {
  EpicNotFoundError,
  StoryNotFoundError,
  StoryViolationError,
} from '../Story/StoryViolation.js'
import { CheckpointViolationError } from '../Checkpoint/CheckpointViolation.js'
import { ZoneNotFoundError, ZoneViolationError } from '../Zone/ZoneViolation.js'
import { CriterionNotFoundError, CriterionViolationError } from '../Criterion/CriterionViolation.js'
import { DispatchViolationError } from '../Dispatch/DispatchViolation.js'
import { ScopeTakenError, ScopeViolationError } from '../Foremerge/ForemergeViolation.js'
import { EvidencePathRefusedError } from '../Evidence/EvidencePath.js'
import { EvidenceShapeRefusedError } from '../Evidence/EvidenceShape.js'
import { EvidenceUnreadableError } from '../Evidence/EvidenceRead.js'
import { BudgetViolationError } from '../Budget/BudgetViolation.js'

export const mapApiError: ErrorHandler = (error, context) => {
  if (error instanceof StoryNotFoundError || error instanceof EpicNotFoundError) {
    return context.json({ error: error.name, message: error.message }, 404)
  }
  if (error instanceof ZoneNotFoundError) {
    return context.json({ error: error.name, message: error.message }, 404)
  }
  if (error instanceof CriterionNotFoundError) {
    return context.json({ error: error.name, message: error.message }, 404)
  }
  if (error instanceof ScopeTakenError) {
    return context.json({ error: error.name, message: error.message, heldBy: error.heldBy }, 409)
  }
  if (
    error instanceof ScopeViolationError ||
    error instanceof StoryViolationError ||
    error instanceof CheckpointViolationError ||
    error instanceof ZoneViolationError ||
    error instanceof CriterionViolationError ||
    error instanceof DispatchViolationError ||
    error instanceof BudgetViolationError ||
    error instanceof EvidencePathRefusedError ||
    error instanceof EvidenceShapeRefusedError ||
    error instanceof EvidenceUnreadableError
  ) {
    return context.json({ error: error.name, message: error.message }, 409)
  }
  return context.json({ error: 'UnexpectedError' }, 500)
}
