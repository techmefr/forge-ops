import { REVIEW_LENS_SEQUENCE, type Checkpoint, type ReviewLens } from '../Checkpoint/Checkpoint.js'
import { criterionProofPathOf, proofDocument } from './ProofDocument.js'
import { SHORT_SHA, type ProofTools } from './StepProofSupport.js'
import type { ProofOrder, ReviewerSession, StepProverInput } from './StepProofTypes.js'
import type { ChangedFile } from './StoryInspection.js'

function lensProblemsOf(order: ProofOrder, cascade: ReturnType<StepProverInput['checkpoints']['reviewCascade']>): readonly string[] {
  const problems: string[] = []
  for (const lens of REVIEW_LENS_SEQUENCE) {
    if (cascade.find((pass) => pass.lens === lens)?.state === 'passed') {
      continue
    }
    const reading = order.verdict.lenses?.[lens]
    if (reading === undefined) {
      problems.push(`the verdict carries no result for the ${lens} lens`)
      continue
    }
    const strong = (reading.findings ?? []).filter((finding) => finding.severity === 'strong')
    if (reading.status !== 'pass' || strong.length > 0) {
      const named = strong.map((finding) => `${finding.path}: ${finding.statement}`)
      problems.push(`the ${lens} lens did not pass${named.length === 0 ? '' : ` (${named.join('; ')})`}`)
    }
  }
  return problems
}

function criterionProblemsOf(
  order: ProofOrder,
  changed: readonly ChangedFile[],
  declared: ReturnType<StepProverInput['criteria']['listCriteria']>,
): readonly string[] {
  const touched = new Set(changed.map((file) => file.path))
  const problems: string[] = []
  for (const criterion of declared.filter((candidate) => !candidate.satisfied)) {
    const answer = order.verdict.criteria?.find((candidate) => candidate.reference === criterion.reference)
    if (answer === undefined || answer.status !== 'met') {
      problems.push(`criterion ${criterion.reference} is not answered as met`)
    } else if (answer.evidence === undefined || !touched.has(answer.evidence)) {
      problems.push(`criterion ${criterion.reference} cites no file changed by this story as evidence`)
    }
  }
  return problems
}

function passLenses(checkpoints: StepProverInput['checkpoints'], order: ProofOrder, session: ReviewerSession): void {
  const cascade = checkpoints.reviewCascade(order.storyId)
  for (const lens of REVIEW_LENS_SEQUENCE) {
    if (cascade.find((pass) => pass.lens === lens)?.state === 'passed') {
      continue
    }
    checkpoints.startLens(order.storyId, lens, session.claudeSessionId)
    for (const finding of order.verdict.lenses?.[lens]?.findings ?? []) {
      checkpoints.recordFinding({
        storyId: order.storyId,
        claudeSessionId: session.claudeSessionId,
        lens,
        severity: finding.severity,
        path: finding.path,
        statement: finding.statement,
      })
    }
    checkpoints.passLens(order.storyId, lens)
  }
}

function satisfyCriteria(
  { criteria, inspection, writeEvidence }: Pick<StepProverInput, 'criteria' | 'inspection' | 'writeEvidence'>,
  order: ProofOrder,
  changed: readonly ChangedFile[],
): void {
  const head = inspection.headSha(order.root).slice(0, SHORT_SHA)
  for (const criterion of criteria.listCriteria(order.storyId).filter((candidate) => !candidate.satisfied)) {
    const evidence = order.verdict.criteria?.find((candidate) => candidate.reference === criterion.reference)?.evidence ?? ''
    const path = criterionProofPathOf(order.storyReference, criterion.reference)
    writeEvidence(
      order.root,
      path,
      proofDocument(`Criterion ${criterion.reference} of ${order.storyReference}`, {
        claim: [`Criterion: ${criterion.statement}`, `The reviewer answered it as met and cited ${evidence}, a file changed by this story.`],
        check: [
          `The cited file is part of the diff of the story branch at HEAD ${head}, and ${changed.length} file(s) changed in total.`,
        ],
      }),
    )
    criteria.satisfyCriterion(criterion.id, path)
  }
}

export function createReviewProof(
  { checkpoints, criteria, inspection, writeEvidence, latestSessionOf }: StepProverInput,
  { factsOf, record }: ProofTools,
) {
  function lensProblems(order: ProofOrder): readonly string[] {
    return lensProblemsOf(order, checkpoints.reviewCascade(order.storyId))
  }

  function criterionProblems(order: ProofOrder, changed: readonly ChangedFile[]): readonly string[] {
    return criterionProblemsOf(order, changed, criteria.listCriteria(order.storyId))
  }

  function proveReviewed(order: ProofOrder): Checkpoint | string {
    const facts = factsOf(order)
    if (typeof facts === 'string') {
      return facts
    }
    const session = latestSessionOf(order.storyId)
    if (session === null) {
      return 'No agent session is recorded for this story, so no review can be attributed'
    }
    const problems = [...lensProblems(order), ...criterionProblems(order, facts.changed)]
    if (problems.length > 0) {
      return `The review cannot be recorded: ${problems.join('; ')}. Answer every lens and every declared criterion in the verdict, and fix what failed.`
    }
    passLenses(checkpoints, order, session)
    satisfyCriteria({ criteria, inspection, writeEvidence }, order, facts.changed)
    const lensLines = REVIEW_LENS_SEQUENCE.map((lens: ReviewLens) => {
      const findings = order.verdict.lenses?.[lens]?.findings ?? []
      return `- ${lens}: pass, ${findings.length} finding(s) recorded, none of them strong`
    })
    const path = record(order, 'reviewed', `Review of ${order.storyReference}`, {
      findings: [
        'Lens results given by the reviewer and accepted by the orchestrator, which refuses a strong finding or a missing lens:',
        ...lensLines,
        `Every declared criterion was answered as met with a file changed by the story, at HEAD ${inspection.headSha(order.root).slice(0, SHORT_SHA)}.`,
      ],
    })
    return checkpoints.proveCheckpoint({ storyId: order.storyId, name: 'reviewed', evidencePath: path })
  }

  return { proveReviewed }
}
