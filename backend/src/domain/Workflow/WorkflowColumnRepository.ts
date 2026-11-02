import type Database from 'better-sqlite3'
import type { WorkflowColumn, WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'
import { DEFAULT_STEP_RETRIES } from '../../../../contract/AutopilotContract.js'
import { behaviouralKindOf, keyOfLabel } from './WorkflowColumn.js'
import { createProjectWorkflowRepository } from './ProjectWorkflowRepository.js'
import { createWorkflowColumnScope } from './WorkflowColumnScope.js'
import { fromRow, prepareWorkflowColumnStatements } from './WorkflowColumnStatements.js'
import { createWorkflowColumnOrder } from './WorkflowColumnOrder.js'
import { WorkflowColumnInUseError } from './WorkflowColumnViolation.js'

export type WorkflowColumnRepository = {
  list: (projectId: number, workflowId?: number) => readonly WorkflowColumn[]
  find: (columnId: number) => WorkflowColumn | null
  create: (projectId: number, draft: WorkflowColumnDraft, workflowId?: number) => WorkflowColumn
  update: (projectId: number, columnId: number, draft: WorkflowColumnDraft) => WorkflowColumn
  remove: (projectId: number, columnId: number) => void
  reorder: (projectId: number, keysInOrder: readonly string[], workflowId?: number) => readonly WorkflowColumn[]
}

export function createWorkflowColumnRepository(db: Database.Database): WorkflowColumnRepository {
  const workflows = createProjectWorkflowRepository(db)
  const statements = prepareWorkflowColumnStatements(db)
  const {
    selectOfWorkflow,
    selectById,
    selectMaxPosition,
    insertColumn,
    updateColumn,
    deleteColumn,
    shiftPositionsDown,
    countStoriesInStep,
  } = statements
  const { scopeOf, list, ownedBy, refuseIfInvalid } = createWorkflowColumnScope(statements, workflows)

  return {
    list,

    find: (columnId) => {
      const row = selectById.get(columnId)
      return row === undefined ? null : fromRow(row)
    },

    create: (projectId, draft, workflowId) => {
      const scope = workflowId === undefined ? workflows.defaultOf(projectId).id : scopeOf(projectId, workflowId)!
      const existing = selectOfWorkflow.all(scope).map(fromRow)
      refuseIfInvalid(draft, existing.map((column) => column.label))
      const key = keyOfLabel(draft.label, existing.map((column) => column.key))
      const nextPosition = (selectMaxPosition.get(scope)?.max_position ?? 0) + 1
      const { lastInsertRowid } = insertColumn.run(
        projectId,
        scope,
        key,
        draft.label.trim(),
        draft.colour,
        nextPosition,
        draft.provider,
        draft.model,
        draft.effort,
        draft.agentName,
        draft.command,
        draft.preprompt,
        draft.autoStart ? 1 : 0,
        draft.maxRetries ?? DEFAULT_STEP_RETRIES,
        behaviouralKindOf(draft),
      )
      return fromRow(selectById.get(Number(lastInsertRowid))!)
    },

    update: (projectId, columnId, draft) => {
      const owned = ownedBy(projectId, columnId)
      refuseIfInvalid(
        draft,
        selectOfWorkflow
          .all(owned.workflow_id)
          .filter((column) => column.id !== columnId)
          .map((column) => column.label),
      )
      updateColumn.run(
        draft.label.trim(),
        draft.colour,
        draft.provider,
        draft.model,
        draft.effort,
        draft.agentName,
        draft.command,
        draft.preprompt,
        draft.autoStart ? 1 : 0,
        draft.maxRetries ?? null,
        behaviouralKindOf(draft),
        columnId,
      )
      return fromRow(selectById.get(columnId)!)
    },

    remove: (projectId, columnId) => {
      const existing = ownedBy(projectId, columnId)
      const held = countStoriesInStep.get(columnId)?.total ?? 0
      if (held > 0) {
        throw new WorkflowColumnInUseError(existing.label, held)
      }
      db.transaction(() => {
        deleteColumn.run(columnId)
        shiftPositionsDown.run(existing.workflow_id, existing.position)
      })()
    },

    reorder: createWorkflowColumnOrder(db, statements, list),
  }
}
