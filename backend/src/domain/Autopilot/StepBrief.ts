import { EVIDENCE_SHAPE } from '../Evidence/EvidenceShape.js'
import type { AgentPhase } from '../Agent/AgentSession.js'
import type { CheckpointName } from '../Checkpoint/Checkpoint.js'

export const MAX_FEEDBACK_LENGTH = 3000

export const AGENT_PROVEN_CHECKPOINTS: readonly CheckpointName[] = ['spec_done', 'arch_done']

const COMMITTING_PHASES: readonly AgentPhase[] = ['tdd', 'code', 'gate', 'review']

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
  phase?: AgentPhase | undefined
  criteriaReferences?: readonly string[] | undefined
  feedback?: string | undefined
}

function reviewLines(criteriaReferences: readonly string[]): readonly string[] {
  const criteria =
    criteriaReferences.length === 0
      ? ''
      : `,"criteria":[${criteriaReferences.map((reference) => `{"reference":"${reference}","status":"met","evidence":"path of a file this story changed"}`).join(',')}]`
  return [
    `- A review verdict also carries one result per lens and one answer per declared criterion: {"status":"pass","reason":"one sentence","lenses":{"quality":{"status":"pass","findings":[]},"security":{"status":"pass","findings":[]},"accessibility":{"status":"pass","findings":[]}}${criteria}}.`,
    '- A finding is {"severity":"strong"|"weak","path":"file","statement":"one sentence"}. A strong finding or a lens with status "fail" stops the card: fix the code first, then write the verdict. Answer "met" for a criterion only when a file this story changed proves it.',
  ]
}

export function stepBriefOf({
  storyReference,
  stepKey,
  proves,
  phase,
  criteriaReferences = [],
  feedback,
}: StepBriefInput): readonly string[] {
  const agentProves = proves !== null && AGENT_PROVEN_CHECKPOINTS.includes(proves) ? proves : null
  const lines = [
    '',
    'Pipeline contract (an orchestrator reads it, it never moves on your word alone):',
    ...(agentProves === null
      ? []
      : [
          `- Write the proof of ${agentProves} in ${proofPathOf(storyReference, agentProves)} with the sections ${EVIDENCE_SHAPE[agentProves].join(', ')}.`,
        ]),
    ...(phase !== undefined && COMMITTING_PHASES.includes(phase)
      ? [
          '- Commit your work on the story branch before the verdict, and never commit .claude/. The orchestrator reads the commits, runs the project test command itself, and reruns your tests in a scratch copy where the production code of the story is reverted: tests that still pass there are refused.',
        ]
      : []),
    ...(phase === 'review' ? reviewLines(criteriaReferences) : []),
    `- When the step is over, write ${verdictPathOf(storyReference, stepKey)} containing {"status":"pass"|"fail"|"blocked","reason":"one sentence"}.`,
    '- Use "blocked" only when you need a human decision, and put the question in reason. Use "fail" when you could not meet the step goal.',
  ]
  if (feedback !== undefined && feedback.trim() !== '') {
    lines.push('', 'The previous attempt of this step was rejected:', feedback.slice(0, MAX_FEEDBACK_LENGTH))
  }
  return lines
}
