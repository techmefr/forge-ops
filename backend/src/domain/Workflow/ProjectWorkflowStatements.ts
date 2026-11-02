import type Database from 'better-sqlite3'
import type { Workflow } from '../../../../contract/WorkflowContract.js'

export type WorkflowRow = {
  id: number
  project_id: number
  key: string
  name: string
  position: number
}

export type ProjectWorkflowStatements = ReturnType<typeof prepareProjectWorkflowStatements>

export function fromRow(row: WorkflowRow): Workflow {
  return { id: row.id, projectId: row.project_id, key: row.key, name: row.name, position: row.position }
}

export function prepareProjectWorkflowStatements(db: Database.Database) {
  return {
    selectOfProject: db.prepare<[number], WorkflowRow>(
      'SELECT * FROM workflow WHERE project_id = ? ORDER BY position ASC',
    ),
    selectById: db.prepare<[number], WorkflowRow>('SELECT * FROM workflow WHERE id = ?'),
    selectMaxPosition: db.prepare<[number], { max_position: number | null }>(
      'SELECT MAX(position) AS max_position FROM workflow WHERE project_id = ?',
    ),
    insertWorkflow: db.prepare<[number, string, string, number]>(
      'INSERT INTO workflow (project_id, key, name, position) VALUES (?, ?, ?, ?)',
    ),
    renameWorkflow: db.prepare<[string, number]>('UPDATE workflow SET name = ? WHERE id = ?'),
    deleteWorkflow: db.prepare<[number]>('DELETE FROM workflow WHERE id = ?'),
    deleteColumnsOf: db.prepare<[number]>('DELETE FROM workflow_column WHERE workflow_id = ?'),
    shiftPositionsDown: db.prepare<[number, number]>(
      'UPDATE workflow SET position = position - 1 WHERE project_id = ? AND position > ?',
    ),
    countStories: db.prepare<[number], { total: number }>('SELECT COUNT(*) AS total FROM story WHERE workflow_id = ?'),
    selectColumnsOf: db.prepare<[number], Record<string, unknown>>(
      'SELECT * FROM workflow_column WHERE workflow_id = ? ORDER BY position ASC',
    ),
    insertColumnCopy: db.prepare<
      [number, number, string, string, string, number, string, string, string, string, string, string, number, number, string]
    >(
      `INSERT INTO workflow_column
       (project_id, workflow_id, key, label, colour, position, provider, model, effort, agent_name, command, preprompt, auto_start, max_retries, behavioural_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
  }
}

export function copyColumns(
  { selectColumnsOf, insertColumnCopy }: ProjectWorkflowStatements,
  projectId: number,
  fromWorkflowId: number,
  toWorkflowId: number,
): void {
  for (const column of selectColumnsOf.all(fromWorkflowId)) {
    insertColumnCopy.run(
      projectId,
      toWorkflowId,
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
}
