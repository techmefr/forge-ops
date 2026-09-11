import { StoryNotYoursError } from './StoryViolation.js'

export function assertStoryHand(reference: string, assignee: string | null, operator: string): void {
  if (assignee !== null && assignee !== operator) {
    throw new StoryNotYoursError(reference, assignee)
  }
}
