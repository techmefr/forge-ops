import { CHECKPOINT_SEQUENCE, REVIEW_LENS_SEQUENCE } from '../../../src/domain/Checkpoint/Checkpoint.js'
import type { CheckpointRepository } from '../../../src/domain/Checkpoint/CheckpointRepository.js'
import type { CriterionRepository } from '../../../src/domain/Criterion/CriterionRepository.js'
import type { AgentSessionRepository } from '../../../src/domain/Agent/AgentSessionRepository.js'
import type { StoryRepository } from '../../../src/domain/Story/StoryRepository.js'
import { STATE_BEFORE_DONE } from '../../../src/domain/Story/DoneGate.js'

export type ProvenStoryInput = {
  stories: StoryRepository
  checkpoints: CheckpointRepository
  criteria: CriterionRepository
  sessions: AgentSessionRepository
  storyId: number
}

export function proveStoryReadyToClose({
  stories,
  checkpoints,
  criteria,
  sessions,
  storyId,
}: ProvenStoryInput): void {
  if (stories.findTwin(storyId) === null) {
    stories.writeTwin({ storyId, title: 'tests', body: 'cas nominal et cas vide' })
  }
  if (criteria.listCriteria(storyId).length === 0) {
    criteria.declareCriterion({ storyId, reference: 'AC-1', statement: 'le cas nominal est couvert' })
  }
  for (const name of CHECKPOINT_SEQUENCE.filter((step) => step !== 'reviewed')) {
    checkpoints.proveCheckpoint({ storyId, name, evidencePath: `.claude/evidence/${name}.md` })
  }
  for (const lens of REVIEW_LENS_SEQUENCE) {
    const claudeSessionId = `proven-story-${storyId}-${lens}`
    sessions.registerSession({
      storyId,
      claudeSessionId,
      phase: 'review',
      agentName: 'reader',
      claudeCodeVersion: '2.1.224',
    })
    checkpoints.startLens(storyId, lens, claudeSessionId)
    checkpoints.passLens(storyId, lens)
  }
  for (const criterion of criteria.listUnmetCriteria(storyId)) {
    criteria.satisfyCriterion(criterion.id, '.claude/evidence/criteria.md')
  }
  checkpoints.proveCheckpoint({
    storyId,
    name: 'reviewed',
    evidencePath: '.claude/evidence/reviewed.md',
  })
  stories.moveToState(storyId, STATE_BEFORE_DONE)
}
