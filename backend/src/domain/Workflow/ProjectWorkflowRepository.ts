import type Database from 'better-sqlite3'
import type { Workflow } from '../../../../contract/WorkflowContract.js'
import { keyOfLabel } from './WorkflowColumn.js'
import {
  copyColumns,
  fromRow,
  prepareProjectWorkflowStatements,
  type WorkflowRow,
} from './ProjectWorkflowStatements.js'
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

export function createProjectWorkflowRepository(db: Database.Database): ProjectWorkflowRepository {
  const statements = prepareProjectWorkflowStatements(db)
  const {
    selectOfProject,
    selectById,
    selectMaxPosition,
    insertWorkflow,
    renameWorkflow,
    deleteWorkflow,
    deleteColumnsOf,
    shiftPositionsDown,
    countStories,
  } = statements

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
        copyColumns(statements, projectId, workflowId, copy.id)
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
