import type { HumanGateWait } from './HumanGate.js'
import { HUMAN_GATE_STATES } from './HumanGate.js'
import type { Story } from './Story.js'
import { toStory } from './StoryRows.js'
import type { StoryStatements } from './StoryStatements.js'
import { StoryNotFoundError } from './StoryViolation.js'

export function createStoryQueries({
  selectProjectOfStory,
  selectHumanGateWaits,
  selectBacklog,
  selectKanban,
}: StoryStatements) {
  return {
    projectOfStory: (storyId: number): number => {
      const row = selectProjectOfStory.get(storyId)
      if (row === undefined) {
        throw new StoryNotFoundError(storyId)
      }
      return row.project_id
    },

    listHumanGateWaits: (): readonly HumanGateWait[] =>
      selectHumanGateWaits.all(...HUMAN_GATE_STATES).map((row) => ({
        storyId: row.id,
        reference: row.reference,
        state: row.state,
        waitingSince: row.updated_at,
        waitingSeconds: row.waiting_seconds,
      })),

    listBacklog: (): readonly Story[] => selectBacklog.all().map(toStory),

    listKanban: (): readonly Story[] => selectKanban.all().map(toStory),
  }
}
