import type { Attention } from '../../../../contract/BoardContract.js'
import type { Milestone, Story } from '../../../../contract/StoryContract.js'

const DAY = 86400000

export type CardFacts = {
  story: Story
  blockers: readonly string[]
  held: boolean
  milestone: Milestone | null
  today: string
}

export function daysLeft(milestone: Milestone | null, today: string): number | null {
  if (milestone === null) {
    return null
  }
  const due = Date.parse(`${milestone.dueOn}T00:00:00Z`)
  const now = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(due) || Number.isNaN(now)) {
    return null
  }
  return Math.round((due - now) / DAY)
}

export function attentionOf(facts: CardFacts): Attention | null {
  if (facts.story.state === 'done') {
    return null
  }
  if (facts.held || facts.blockers.length > 0 || facts.story.blockedReason !== null) {
    return 'blocked'
  }
  if (facts.story.mergeConflict) {
    return 'conflict'
  }
  if (facts.story.state === 'plan_review' || facts.story.state === 'shipping') {
    return 'gate'
  }
  const left = daysLeft(facts.milestone, facts.today)
  return left !== null && left < 0 ? 'late' : null
}

export function nextMilestone(
  milestones: readonly Milestone[],
  today: string,
): Milestone | null {
  const dated = [...milestones].sort((one, other) => one.dueOn.localeCompare(other.dueOn))
  return dated.find((milestone) => milestone.dueOn >= today) ?? dated[dated.length - 1] ?? null
}
