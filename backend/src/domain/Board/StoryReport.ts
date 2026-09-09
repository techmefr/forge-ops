import type { AgentSessionRepository } from '../Agent/AgentSessionRepository.js'
import type { CheckpointRepository } from '../Checkpoint/CheckpointRepository.js'
import type { CriterionRepository } from '../Criterion/CriterionRepository.js'
import type { StoryRepository } from '../Story/StoryRepository.js'

export type ReportFact =
  | { kind: 'checkpoint'; statement: string; evidencePath: string }
  | { kind: 'criterion'; statement: string; evidencePath: string }
  | { kind: 'cost'; statement: string; costUsd: number; inputTokens: number; outputTokens: number }

export type ReportJudgement =
  | { kind: 'finding'; statement: string; lens: string; severity: string; path: string }
  | { kind: 'criterion_unmet'; statement: string; reference: string }
  | { kind: 'blocker'; statement: string; reference: string }

export type StoryReport = {
  facts: readonly ReportFact[]
  judgements: readonly ReportJudgement[]
}

export type StoryReportInput = {
  storyId: number
  stories: StoryRepository
  checkpoints: CheckpointRepository
  criteria: CriterionRepository
  sessions: AgentSessionRepository
}

export function buildStoryReport({
  storyId,
  stories,
  checkpoints,
  criteria,
  sessions,
}: StoryReportInput): StoryReport {
  const facts: ReportFact[] = []
  const judgements: ReportJudgement[] = []

  for (const step of checkpoints.definitionOfDone(storyId)) {
    if (step.proven && step.evidencePath !== null) {
      facts.push({
        kind: 'checkpoint',
        statement: `${step.name} est prouve`,
        evidencePath: step.evidencePath,
      })
    }
  }

  for (const criterion of criteria.listCriteria(storyId)) {
    if (criterion.evidencePath === null) {
      judgements.push({
        kind: 'criterion_unmet',
        statement: `${criterion.reference} n'est pas encore prouve`,
        reference: criterion.reference,
      })
      continue
    }
    facts.push({
      kind: 'criterion',
      statement: `${criterion.reference} est prouve`,
      evidencePath: criterion.evidencePath,
    })
  }

  for (const finding of checkpoints.listUnresolvedFindings(storyId)) {
    judgements.push({
      kind: 'finding',
      statement: finding.statement,
      lens: finding.lens,
      severity: finding.severity,
      path: finding.path,
    })
  }

  for (const reference of stories.listBlockers(storyId)) {
    judgements.push({ kind: 'blocker', statement: `la story attend ${reference}`, reference })
  }

  const usage = sessions.sumUsage(storyId)
  if (usage.costUsd > 0 || usage.inputTokens > 0 || usage.outputTokens > 0) {
    facts.push({
      kind: 'cost',
      statement: `${usage.costUsd.toFixed(2)} dollars et ${usage.inputTokens + usage.outputTokens} jetons consommes`,
      ...usage,
    })
  }

  return { facts, judgements }
}
