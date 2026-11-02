import type { WorkflowColumn, WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'
import type { createProjectWorkflowRepository } from './ProjectWorkflowRepository.js'
import { WorkflowNotFoundError } from './ProjectWorkflowViolation.js'
import { refusalOfDraft } from './WorkflowColumn.js'
import { fromRow, type ColumnRow, type WorkflowColumnStatements } from './WorkflowColumnStatements.js'
import { WorkflowColumnNotFoundError, WorkflowColumnRefusedError } from './WorkflowColumnViolation.js'

export function createWorkflowColumnScope(
  { selectOfWorkflow, selectById }: WorkflowColumnStatements,
  workflows: ReturnType<typeof createProjectWorkflowRepository>,
) {
  function scopeOf(projectId: number, workflowId: number | undefined): number | null {
    if (workflowId === undefined || workflowId === 0) {
      return workflows.list(projectId)[0]?.id ?? null
    }
    const workflow = workflows.find(workflowId)
    if (workflow === null || workflow.projectId !== projectId) {
      throw new WorkflowNotFoundError(workflowId)
    }
    return workflow.id
  }

  function list(projectId: number, workflowId?: number): readonly WorkflowColumn[] {
    const scope = scopeOf(projectId, workflowId)
    return scope === null ? [] : selectOfWorkflow.all(scope).map(fromRow)
  }

  function ownedBy(projectId: number, columnId: number): ColumnRow {
    const row = selectById.get(columnId)
    if (row === undefined || row.project_id !== projectId) {
      throw new WorkflowColumnNotFoundError(columnId)
    }
    return row
  }

  function refuseIfInvalid(draft: WorkflowColumnDraft, otherLabels: readonly string[]): void {
    const refusal = refusalOfDraft(draft, otherLabels)
    if (refusal !== null) {
      throw new WorkflowColumnRefusedError(refusal)
    }
  }

  return { scopeOf, list, ownedBy, refuseIfInvalid }
}
