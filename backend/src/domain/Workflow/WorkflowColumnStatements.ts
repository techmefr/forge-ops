import type Database from 'better-sqlite3'
import type {
  BehaviouralKind,
  WorkflowColumn,
  WorkflowEffort,
  WorkflowProvider,
} from '../../../../contract/WorkflowColumnContract.js'

export type ColumnRow = {
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

export type WorkflowColumnStatements = ReturnType<typeof prepareWorkflowColumnStatements>

export function fromRow(row: ColumnRow): WorkflowColumn {
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

export function prepareWorkflowColumnStatements(db: Database.Database) {
  return {
    selectOfWorkflow: db.prepare<[number], ColumnRow>(
      'SELECT * FROM workflow_column WHERE workflow_id = ? ORDER BY position ASC',
    ),
    selectById: db.prepare<[number], ColumnRow>('SELECT * FROM workflow_column WHERE id = ?'),
    selectMaxPosition: db.prepare<[number], { max_position: number | null }>(
      'SELECT MAX(position) AS max_position FROM workflow_column WHERE workflow_id = ?',
    ),
    insertColumn: db.prepare<
      [number, number, string, string, string, number, string, string, string, string, string, string, number, number, string]
    >(
      `INSERT INTO workflow_column
       (project_id, workflow_id, key, label, colour, position, provider, model, effort, agent_name, command, preprompt, auto_start, max_retries, behavioural_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    updateColumn: db.prepare<[string, string, string, string, string, string, string, string, number, number | null, string, number]>(
      `UPDATE workflow_column
        SET label = ?, colour = ?, provider = ?, model = ?, effort = ?, agent_name = ?, command = ?,
            preprompt = ?, auto_start = ?, max_retries = COALESCE(?, max_retries), behavioural_kind = ?
      WHERE id = ?`,
    ),
    deleteColumn: db.prepare<[number]>('DELETE FROM workflow_column WHERE id = ?'),
    shiftPositionsDown: db.prepare<[number, number]>(
      'UPDATE workflow_column SET position = position - 1 WHERE workflow_id = ? AND position > ?',
    ),
    updatePosition: db.prepare<[number, number]>('UPDATE workflow_column SET position = ? WHERE id = ?'),
    countStoriesInStep: db.prepare<[number], { total: number }>(
      'SELECT COUNT(*) AS total FROM story WHERE workflow_column_id = ?',
    ),
  }
}
