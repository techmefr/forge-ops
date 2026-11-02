import { REVIEW_LENS_SEQUENCE, type ReviewLens, type ReviewPass } from './Checkpoint.js'
import type { ReviewStatements } from './ReviewStatements.js'
import { StoryNotFoundError } from '../Story/StoryViolation.js'

export function createReviewCascade({ selectPasses }: ReviewStatements) {
  function reviewCascade(storyId: number): readonly ReviewPass[] {
    const rows = selectPasses.all(storyId)
    return REVIEW_LENS_SEQUENCE.map((lens) => {
      const row = rows.find((candidate) => candidate.lens === lens)
      return {
        lens,
        state: row?.state ?? 'pending',
        agentName: row?.agent_name ?? null,
      }
    })
  }

  function passOf(storyId: number, lens: ReviewLens): ReviewPass {
    const pass = reviewCascade(storyId).find((candidate) => candidate.lens === lens)
    if (pass === undefined) {
      throw new StoryNotFoundError(storyId)
    }
    return pass
  }

  return { reviewCascade, passOf }
}
