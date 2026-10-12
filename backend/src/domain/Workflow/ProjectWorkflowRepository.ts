import type Database from 'better-sqlite3'
import type { Workflow } from '../../../../contract/WorkflowContract.js'
import { keyOfLabel } from './WorkflowColumn.js'
import {
  WorkflowInUseError,
  WorkflowNotFoundError,
  WorkflowRefusedError,
} from './ProjectWorkflowViolation.js'

export const DEFAULT_WORKFLOW_NAME = 'Default'

export type ProjectWorkflowRepository = {
  list: (projectId: number) => readonly Workflow[]
  find: (workflowId: number) => Workflow | null
  defaultOf: (projectId: number) => Workflow
  create: (projectId: number, name: string) => Workflow
  rename: (projectId: number, workflowId: number, name: string) => Workflow
  duplicate: (projectId: number, workflowId: number, name: string) => Workflow
  remove: (projectId: number, workflowId: number) => void
}

type WorkflowRow = {
  id: number
  project_id: number
  key: string
  name: string
  position: number
}

function fromRow(row: WorkflowRow): Workflow {
  return { id: row.id, projectId: row.project_id, key: row.key, name: row.name, position: row.position }
}

export function createProjectWorkflowRepository(db: Database.Database): ProjectWorkflowRepository {
  const selectOfProject = db.prepare<[number], WorkflowRow>(
    'SELECT * FROM workflow WHERE project_id = ? ORDER BY position ASC',
  )
  const selectById = db.prepare<[number], WorkflowRow>('SELECT * FROM workflow WHERE id = ?')
  const selectMaxPosition = db.prepare<[number], { max_position: number | null }>(
    'SELECT MAX(position) AS max_position FROM workflow WHERE project_id = ?',
  )
  const insertWorkflow = db.prepare<[number, string, string, number]>(
    'INSERT INTO workflow (project_id, key, name, position) VALUES (?, ?, ?, ?)',
  )
  const renameWorkflow = db.prepare<[string, number]>('UPDATE workflow SET name = ? WHERE id = ?')
  const deleteWorkflow = db.prepare<[number]>('DELETE FROM workflow WHERE id = ?')
  const deleteColumnsOf = db.prepare<[number]>('DELETE FROM workflow_column WHERE workflow_id = ?')
  const shiftPositionsDown = db.prepare<[number, number]>(
    'UPDATE workflow SET position = position - 1 WHERE project_id = ? AND position > ?',
  )
  const countStories = db.prepare<[number], { total: number }>(
    'SELECT COUNT(*) AS total FROM story WHERE workflow_id = ?',
  )
  const selectColumnsOf = db.prepare<[number], Record<string, unknown>>(
    'SELECT * FROM workflow_column WHERE workflow_id = ? ORDER BY position ASC',
  )
  const insertColumnCopy = db.prepare<
    [number, number, string, string, string, number, string, string, string, string, string, string, number, number, string]
  >(
    `INSERT INTO workflow_column
       (project_id, workflow_id, key, label, colour, position, provider, model, effort, agent_name, command, preprompt, auto_start, max_retries, behavioural_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  function list(projectId: number): readonly Workflow[] {
    return selectOfProject.all(projectId).map(fromRow)
  }

  function ownedBy(projectId: number, workflowId: number): WorkflowRow {
    const row = selectById.get(workflowId)
    if (row === undefined || row.project_id !== projectId) {
      throw new WorkflowNotFoundError(workflowId)
    }
    return row
  }

  function refuseIfInvalid(name: string, otherNames: readonly string[]): string {
    const trimmed = name.trim()
    if (trimmed === '') {
      throw new WorkflowRefusedError({ reason: 'EmptyName' })
    }
    if (otherNames.some((other) => other.trim().toLowerCase() === trimmed.toLowerCase())) {
      throw new WorkflowRefusedError({ reason: 'DuplicateName', name: trimmed })
    }
    return trimmed
  }

  function insert(projectId: number, name: string): Workflow {
    const existing = list(projectId)
    const trimmed = refuseIfInvalid(
      name,
      existing.map((workflow) => workflow.name),
    )
    const key = keyOfLabel(
      trimmed,
      existing.map((workflow) => workflow.key),
    )
    const position = (selectMaxPosition.get(projectId)?.max_position ?? 0) + 1
    const { lastInsertRowid } = insertWorkflow.run(projectId, key, trimmed, position)
    return fromRow(selectById.get(Number(lastInsertRowid))!)
  }

  return {
    list,

    find: (workflowId) => {
      const row = selectById.get(workflowId)
      return row === undefined ? null : fromRow(row)
    },

    defaultOf: (projectId) => {
      const first = list(projectId)[0]
      return first ?? insert(projectId, DEFAULT_WORKFLOW_NAME)
    },

    create: insert,

    rename: (projectId, workflowId, name) => {
      ownedBy(projectId, workflowId)
      const trimmed = refuseIfInvalid(
        name,
        list(projectId)
          .filter((workflow) => workflow.id !== workflowId)
          .map((workflow) => workflow.name),
      )
      renameWorkflow.run(trimmed, workflowId)
      return fromRow(selectById.get(workflowId)!)
    },

    duplicate: (projectId, workflowId, name) =>
      db.transaction((): Workflow => {
        ownedBy(projectId, workflowId)
        const copy = insert(projectId, name)
        for (const column of selectColumnsOf.all(workflowId)) {
          insertColumnCopy.run(
            projectId,
            copy.id,
            column['key'] as string,
            column['label'] as string,
            column['colour'] as string,
            column['position'] as number,
            column['provider'] as string,
            column['model'] as string,
            column['effort'] as string,
            column['agent_name'] as string,
            column['command'] as string,
            column['preprompt'] as string,
            column['auto_start'] as number,
            column['max_retries'] as number,
            column['behavioural_kind'] as string,
          )
        }
        return copy
      })(),

    remove: (projectId, workflowId) => {
      const existing = ownedBy(projectId, workflowId)
      if (list(projectId).length <= 1) {
        throw new WorkflowRefusedError({ reason: 'LastWorkflow' })
      }
      const held = countStories.get(workflowId)?.total ?? 0
      if (held > 0) {
        throw new WorkflowInUseError(existing.name, held)
      }
      db.transaction(() => {
        deleteColumnsOf.run(workflowId)
        deleteWorkflow.run(workflowId)
        shiftPositionsDown.run(projectId, existing.position)
      })()
    },
  }
}

export const STORY_WORKFLOW_ID_SQL = `COALESCE(
  story.workflow_id,
  (SELECT workflow.id FROM workflow
     JOIN epic AS owner ON owner.project_id = workflow.project_id
    WHERE owner.id = story.epic_id
    ORDER BY workflow.position ASC
    LIMIT 1)
)`
