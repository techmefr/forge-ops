import { EVIDENCE_SHAPE } from '../Evidence/EvidenceShape.js'
import type { CheckpointName } from '../Checkpoint/Checkpoint.js'

export const MAX_FEEDBACK_LENGTH = 3000

export function verdictPathOf(storyReference: string, stepKey: string): string {
  return `.claude/evidence/${storyReference}/${stepKey}.verdict.json`
}

export function proofPathOf(storyReference: string, checkpoint: CheckpointName): string {
  return `.claude/evidence/${storyReference}/${checkpoint}.md`
}

export type StepBriefInput = {
  storyReference: string
  stepKey: string
  proves: CheckpointName | null
  feedback?: string | undefined
}

export function stepBriefOf({ storyReference, stepKey, proves, feedback }: StepBriefInput): readonly string[] {
  const lines = [
    '',
    'Pipeline contract (an orchestrator reads it, it never moves on your word alone):',
    ...(proves === null
      ? []
      : [
          `- Write the proof of ${proves} in ${proofPathOf(storyReference, proves)} with the sections ${EVIDENCE_SHAPE[proves].join(', ')}.`,
        ]),
    `- When the step is over, write ${verdictPathOf(storyReference, stepKey)} containing {"status":"pass"|"fail"|"blocked","reason":"one sentence"}.`,
    '- Use "blocked" only when you need a human decision, and put the question in reason. Use "fail" when you could not meet the step goal.',
  ]
  if (feedback !== undefined && feedback.trim() !== '') {
    lines.push('', 'The previous attempt of this step was rejected:', feedback.slice(0, MAX_FEEDBACK_LENGTH))
  }
  return lines
}
