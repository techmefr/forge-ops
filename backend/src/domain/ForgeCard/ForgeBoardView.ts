import { BACKLOG_STEP_KEY, DONE_STEP_KEY, type ForgeCardView } from '../../../../contract/ForgeCardContract.js'
import type { AutoCardView } from '../../../../contract/AutopilotContract.js'
import type { WorkflowColumn } from '../../../../contract/WorkflowColumnContract.js'
import type { CardRow, ForgeBoardStatements } from './ForgeBoardStatements.js'
import { phaseOfStep, statusOf, type LatestSession } from './ForgeCardStatus.js'

function stepKeyOf(row: CardRow, steps: readonly WorkflowColumn[]): string {
  if (row.state === 'done') {
    return DONE_STEP_KEY
  }
  const placed = steps.find((step) => step.id === row.workflow_column_id)
  if (placed !== undefined) {
    return placed.key
  }
  return BACKLOG_STEP_KEY
}

export function createForgeBoardView(
  { selectLatestSession, selectTotals }: ForgeBoardStatements,
  autoOf: ((view: ForgeCardView) => AutoCardView | null) | undefined,
) {
  function viewOf(row: CardRow, steps: readonly WorkflowColumn[]): ForgeCardView {
    const stepKey = stepKeyOf(row, steps)
    const step = steps.find((candidate) => candidate.key === stepKey)
    const latest = selectLatestSession.get(row.story_id)
    const totals = selectTotals.get(row.story_id)
    const currentPhase = phaseOfStep(
      stepKey,
      steps.map((candidate) => candidate.key),
    )
    const session: LatestSession | null =
      latest === undefined ? null : { phase: latest.phase, lifecycle: latest.lifecycle, outcome: latest.outcome }
    const view: ForgeCardView = {
      id: row.id,
      reference: row.reference,
      storyId: row.story_id,
      storyReference: row.story_reference,
      title: row.title,
      projectId: row.project_id,
      workflowId: row.workflow_id ?? 0,
      subjectId: row.epic_id,
      subjectTitle: row.epic_title,
      stepKey,
      provider: row.provider,
      status: statusOf({
        stepKey,
        stepIsHuman: step?.provider === 'human',
        currentPhase,
        latest: session,
      }),
      claudeSessionId: latest?.claude_session_id ?? row.claude_session_id,
      durationSeconds: totals?.seconds ?? 0,
      costUsd: Number((totals?.cost ?? 0).toFixed(4)),
    }
    const auto = autoOf?.(view) ?? null
    return auto === null ? view : { ...view, auto }
  }

  return { viewOf }
}
