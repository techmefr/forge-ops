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
import {
  WorkflowColumnInUseError,
  WorkflowColumnNotFoundError,
  WorkflowColumnRefusedError,
} from './WorkflowColumnViolation.js'

export type WorkflowColumnRepository = {
  list: (projectId: number) => readonly WorkflowColumn[]
  find: (columnId: number) => WorkflowColumn | null
  create: (projectId: number, draft: WorkflowColumnDraft) => WorkflowColumn
  update: (projectId: number, columnId: number, draft: WorkflowColumnDraft) => WorkflowColumn
  remove: (projectId: number, columnId: number) => void
  reorder: (projectId: number, keysInOrder: readonly string[]) => readonly WorkflowColumn[]
}

type ColumnRow = {
  id: number
  project_id: number
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
  const selectOfProject = db.prepare<[number], ColumnRow>(
    'SELECT * FROM workflow_column WHERE project_id = ? ORDER BY position ASC',
  )
  const selectById = db.prepare<[number], ColumnRow>('SELECT * FROM workflow_column WHERE id = ?')
  const selectMaxPosition = db.prepare<[number], { max_position: number | null }>(
    'SELECT MAX(position) AS max_position FROM workflow_column WHERE project_id = ?',
  )
  const insertColumn = db.prepare<
    [number, string, string, string, number, string, string, string, string, string, string, number, number, string]
  >(
    `INSERT INTO workflow_column
       (project_id, key, label, colour, position, provider, model, effort, agent_name, command, preprompt, auto_start, max_retries, behavioural_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const updateColumn = db.prepare<[string, string, string, string, string, string, string, string, number, number | null, string, number]>(
    `UPDATE workflow_column
        SET label = ?, colour = ?, provider = ?, model = ?, effort = ?, agent_name = ?, command = ?,
            preprompt = ?, auto_start = ?, max_retries = COALESCE(?, max_retries), behavioural_kind = ?
      WHERE id = ?`,
  )
  const deleteColumn = db.prepare<[number]>('DELETE FROM workflow_column WHERE id = ?')
  const shiftPositionsDown = db.prepare<[number, number]>(
    'UPDATE workflow_column SET position = position - 1 WHERE project_id = ? AND position > ?',
  )
  const updatePosition = db.prepare<[number, number]>('UPDATE workflow_column SET position = ? WHERE id = ?')
  const countStoriesInStep = db.prepare<[number], { total: number }>(
    'SELECT COUNT(*) AS total FROM story WHERE workflow_column_id = ?',
  )

  function list(projectId: number): readonly WorkflowColumn[] {
    return selectOfProject.all(projectId).map(fromRow)
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

    create: (projectId, draft) => {
      const existing = list(projectId)
      refuseIfInvalid(draft, existing.map((column) => column.label))
      const key = keyOfLabel(draft.label, existing.map((column) => column.key))
      const nextPosition = (selectMaxPosition.get(projectId)?.max_position ?? 0) + 1
      const { lastInsertRowid } = insertColumn.run(
        projectId,
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
      ownedBy(projectId, columnId)
      refuseIfInvalid(
        draft,
        list(projectId)
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
        shiftPositionsDown.run(projectId, existing.position)
      })()
    },

    reorder: (projectId, keysInOrder) => {
      const current = list(projectId)
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
      return list(projectId)
    },
  }
}
