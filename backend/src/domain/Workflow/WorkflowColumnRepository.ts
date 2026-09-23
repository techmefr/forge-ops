import type Database from 'better-sqlite3'
import type { WorkflowColumn, WorkflowColumnDraft } from '../../../../contract/WorkflowColumnContract.js'
import { refusalOfDraft, SEED_WORKFLOW_COLUMNS } from './WorkflowColumn.js'
import { WorkflowColumnRefusedError } from './WorkflowColumnViolation.js'

export type WorkflowColumnRepository = {
  list: () => readonly WorkflowColumn[]
  create: (draft: WorkflowColumnDraft) => WorkflowColumn
  remove: (id: number) => void
  reorder: (keysInOrder: readonly string[]) => readonly WorkflowColumn[]
  update: (id: number, draft: Omit<WorkflowColumnDraft, 'key'>) => WorkflowColumn
}

type ColumnRow = {
  id: number
  key: string
  label: string
  colour: string
  position: number
  agent_name: string
  command: string
  preprompt: string
  behavioural_kind: WorkflowColumn['behaviouralKind']
}

function fromRow(row: ColumnRow): WorkflowColumn {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    colour: row.colour,
    position: row.position,
    agentName: row.agent_name,
    command: row.command,
    preprompt: row.preprompt,
    behaviouralKind: row.behavioural_kind,
  }
}

export function createWorkflowColumnRepository(db: Database.Database): WorkflowColumnRepository {
  const seedIfEmpty = db.transaction(() => {
    const { total } = db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM workflow_column').get()!
    if (total > 0) {
      return
    }
    const insert = db.prepare<[string, string, string, number, string, string, string, string]>(
      `INSERT INTO workflow_column (key, label, colour, position, agent_name, command, preprompt, behavioural_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    SEED_WORKFLOW_COLUMNS.forEach((seed, index) => {
      insert.run(seed.key, seed.label, seed.colour, index + 1, seed.agentName, seed.command, seed.preprompt, seed.behaviouralKind)
    })
  })
  seedIfEmpty()

  const selectAll = db.prepare<[], ColumnRow>('SELECT * FROM workflow_column ORDER BY position ASC')
  const selectKeys = db.prepare<[], { key: string }>('SELECT key FROM workflow_column')
  const selectMaxPosition = db.prepare<[], { max_position: number | null }>(
    'SELECT MAX(position) AS max_position FROM workflow_column',
  )
  const selectById = db.prepare<[number], ColumnRow>('SELECT * FROM workflow_column WHERE id = ?')
  const insertColumn = db.prepare<[string, string, string, number, string, string, string, string]>(
    `INSERT INTO workflow_column (key, label, colour, position, agent_name, command, preprompt, behavioural_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const deleteColumn = db.prepare<[number]>('DELETE FROM workflow_column WHERE id = ?')
  const shiftPositionsDown = db.prepare<[number]>(
    'UPDATE workflow_column SET position = position - 1 WHERE position > ?',
  )
  const updatePosition = db.prepare<[number, number]>('UPDATE workflow_column SET position = ? WHERE id = ?')
  const updateColumn = db.prepare<[string, string, string, string, string, string, number]>(
    `UPDATE workflow_column
        SET label = ?, colour = ?, agent_name = ?, command = ?, preprompt = ?, behavioural_kind = ?
      WHERE id = ?`,
  )

  function list(): readonly WorkflowColumn[] {
    return selectAll.all().map(fromRow)
  }

  return {
    list,

    create: (draft) => {
      const refusal = refusalOfDraft(draft, selectKeys.all().map((row) => row.key))
      if (refusal !== null) {
        throw new WorkflowColumnRefusedError(refusal)
      }
      const nextPosition = (selectMaxPosition.get()?.max_position ?? 0) + 1
      const { lastInsertRowid } = insertColumn.run(
        draft.key,
        draft.label,
        draft.colour,
        nextPosition,
        draft.agentName,
        draft.command,
        draft.preprompt,
        draft.behaviouralKind,
      )
      return fromRow(selectById.get(Number(lastInsertRowid))!)
    },

    remove: (id) => {
      const existing = selectById.get(id)
      if (existing === undefined) {
        return
      }
      db.transaction(() => {
        deleteColumn.run(id)
        shiftPositionsDown.run(existing.position)
      })()
    },

    reorder: (keysInOrder) => {
      const current = list()
      const currentKeys = current.map((column) => column.key)
      const sameSet =
        keysInOrder.length === currentKeys.length && currentKeys.every((key) => keysInOrder.includes(key))
      if (!sameSet) {
        throw new WorkflowColumnRefusedError({ reason: 'DuplicateKey', key: keysInOrder.join(',') })
      }
      db.transaction(() => {
        keysInOrder.forEach((key, index) => {
          const column = current.find((candidate) => candidate.key === key)!
          updatePosition.run(-1 * (index + 1), column.id)
        })
        keysInOrder.forEach((key, index) => {
          const column = current.find((candidate) => candidate.key === key)!
          updatePosition.run(index + 1, column.id)
        })
      })()
      return list()
    },

    update: (id, draft) => {
      const existing = selectById.get(id)
      if (existing === undefined) {
        throw new WorkflowColumnRefusedError({ reason: 'EmptyKey' })
      }
      const otherKeys = selectKeys.all().map((row) => row.key).filter((key) => key !== existing.key)
      const refusal = refusalOfDraft({ ...draft, key: existing.key }, otherKeys)
      if (refusal !== null) {
        throw new WorkflowColumnRefusedError(refusal)
      }
      updateColumn.run(
        draft.label,
        draft.colour,
        draft.agentName,
        draft.command,
        draft.preprompt,
        draft.behaviouralKind,
        id,
      )
      return fromRow(selectById.get(id)!)
    },
  }
}
