import type Database from 'better-sqlite3'
import type {
  BehaviouralKind,
  WorkflowColumn,
  WorkflowColumnDraft,
  WorkflowEffort,
  WorkflowProvider,
} from '../../../../contract/WorkflowColumnContract.js'
import { DEFAULT_STEP_RETRIES } from '../../../../contract/AutopilotContract.js'
import { behaviouralKindOf, keyOfLabel, refusalOfDraft } from './WorkflowColumn.js'
import { createProjectWorkflowRepository } from './ProjectWorkflowRepository.js'
import {
  WorkflowColumnInUseError,
  WorkflowColumnNotFoundError,
  WorkflowColumnRefusedError,
} from './WorkflowColumnViolation.js'
import { WorkflowNotFoundError } from './ProjectWorkflowViolation.js'

export type WorkflowColumnRepository = {
  list: (projectId: number, workflowId?: number) => readonly WorkflowColumn[]
  find: (columnId: number) => WorkflowColumn | null
  create: (projectId: number, draft: WorkflowColumnDraft, workflowId?: number) => WorkflowColumn
  update: (projectId: number, columnId: number, draft: WorkflowColumnDraft) => WorkflowColumn
  remove: (projectId: number, columnId: number) => void
  reorder: (projectId: number, keysInOrder: readonly string[], workflowId?: number) => readonly WorkflowColumn[]
}

type ColumnRow = {
  id: number
  project_id: number
  workflow_id: number
  key: string
  label: string
  colour: string
  position: number
  provider: WorkflowProvider
  model: string
  effort: WorkflowEffort | ''
  agent_name: string
  command: string
  preprompt: string
  auto_start: number
  max_retries: number
  behavioural_kind: BehaviouralKind
}

function fromRow(row: ColumnRow): WorkflowColumn {
  return {
    id: row.id,
    projectId: row.project_id,
    workflowId: row.workflow_id,
    key: row.key,
    label: row.label,
    colour: row.colour,
    position: row.position,
    provider: row.provider,
    model: row.model,
    effort: row.effort,
    agentName: row.agent_name,
    command: row.command,
    preprompt: row.preprompt,
    autoStart: row.auto_start === 1,
    maxRetries: row.max_retries,
    behaviouralKind: row.behavioural_kind,
  }
}

export function createWorkflowColumnRepository(db: Database.Database): WorkflowColumnRepository {
  const workflows = createProjectWorkflowRepository(db)
  const selectOfWorkflow = db.prepare<[number], ColumnRow>(
    'SELECT * FROM workflow_column WHERE workflow_id = ? ORDER BY position ASC',
  )
  const selectById = db.prepare<[number], ColumnRow>('SELECT * FROM workflow_column WHERE id = ?')
  const selectMaxPosition = db.prepare<[number], { max_position: number | null }>(
    'SELECT MAX(position) AS max_position FROM workflow_column WHERE workflow_id = ?',
  )
  const insertColumn = db.prepare<
    [number, number, string, string, string, number, string, string, string, string, string, string, number, number, string]
  >(
    `INSERT INTO workflow_column
       (project_id, workflow_id, key, label, colour, position, provider, model, effort, agent_name, command, preprompt, auto_start, max_retries, behavioural_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const updateColumn = db.prepare<[string, string, string, string, string, string, string, string, number, number | null, string, number]>(
    `UPDATE workflow_column
        SET label = ?, colour = ?, provider = ?, model = ?, effort = ?, agent_name = ?, command = ?,
            preprompt = ?, auto_start = ?, max_retries = COALESCE(?, max_retries), behavioural_kind = ?
      WHERE id = ?`,
  )
  const deleteColumn = db.prepare<[number]>('DELETE FROM workflow_column WHERE id = ?')
  const shiftPositionsDown = db.prepare<[number, number]>(
    'UPDATE workflow_column SET position = position - 1 WHERE workflow_id = ? AND position > ?',
  )
  const updatePosition = db.prepare<[number, number]>('UPDATE workflow_column SET position = ? WHERE id = ?')
  const countStoriesInStep = db.prepare<[number], { total: number }>(
    'SELECT COUNT(*) AS total FROM story WHERE workflow_column_id = ?',
  )

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

    reorder: (projectId, keysInOrder, workflowId) => {
      const current = list(projectId, workflowId)
      const sameSet =
        keysInOrder.length === current.length &&
        new Set(keysInOrder).size === current.length &&
        current.every((column) => keysInOrder.includes(column.key))
      if (!sameSet) {
        throw new WorkflowColumnRefusedError({ reason: 'OrderMismatch' })
      }
      db.transaction(() => {
        keysInOrder.forEach((key, index) => {
          updatePosition.run(-1 * (index + 1), current.find((column) => column.key === key)!.id)
        })
        keysInOrder.forEach((key, index) => {
          updatePosition.run(index + 1, current.find((column) => column.key === key)!.id)
        })
      })()
      return list(projectId, workflowId)
    },
  }
}
