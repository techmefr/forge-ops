import type Database from 'better-sqlite3'

export type SheetRow = {
  id: number
  slug: string
  name: string
  colour: string
  position: number
  admin_user_id: number | null
  admin_login: string | null
  admin_name: string | null
  usage: number
}

export type ProjectStatements = ReturnType<typeof prepareProjectStatements>

const SHEET_QUERY = `SELECT project.id, project.slug, project.name, project.colour, project.position,
         project.admin_user_id, board_user.login AS admin_login, board_user.display_name AS admin_name,
         (SELECT COUNT(*) FROM epic WHERE epic.project_id = project.id) AS usage
    FROM project LEFT JOIN board_user ON board_user.id = project.admin_user_id`

export function prepareProjectStatements(db: Database.Database) {
  return {
    selectSheets: db.prepare<[], SheetRow>(`${SHEET_QUERY} ORDER BY project.position, project.name`),
    selectSheet: db.prepare<[number], SheetRow>(`${SHEET_QUERY} WHERE project.id = ?`),
    selectUser: db.prepare<[number], { disabled_at: string | null }>('SELECT disabled_at FROM board_user WHERE id = ?'),
    updateColour: db.prepare<[string, number]>('UPDATE project SET colour = ? WHERE id = ?'),
    updatePosition: db.prepare<[number, number]>('UPDATE project SET position = ? WHERE id = ?'),
    selectOrder: db.prepare<[], { id: number }>('SELECT id FROM project ORDER BY position, name, id'),
    updateAdmin: db.prepare<[number | null, number]>('UPDATE project SET admin_user_id = ? WHERE id = ?'),
    selectAdmin: db.prepare<[number], { admin_user_id: number | null }>(
      'SELECT admin_user_id FROM project WHERE id = ?',
    ),
    deleteLinks: db.prepare<[number]>('DELETE FROM project_link WHERE project_id = ?'),
    deleteTemplate: db.prepare<[number]>('DELETE FROM project_template WHERE project_id = ?'),
    deleteRisks: db.prepare<[number]>('DELETE FROM project_risk WHERE project_id = ?'),
    deleteDecisions: db.prepare<[number]>('DELETE FROM project_decision WHERE project_id = ?'),
    deleteZones: db.prepare<[number]>('DELETE FROM zone WHERE project_id = ?'),
    deleteWorkflowColumns: db.prepare<[number]>('DELETE FROM workflow_column WHERE project_id = ?'),
    deleteWorkflows: db.prepare<[number]>('DELETE FROM workflow WHERE project_id = ?'),
    deleteBatchStories: db.prepare<[number]>(
      'DELETE FROM batch_story WHERE batch_id IN (SELECT id FROM merge_batch WHERE project_id = ?)',
    ),
    deleteEvents: db.prepare<[number]>('DELETE FROM epic_milestone WHERE project_id = ?'),
    deleteBatches: db.prepare<[number]>('DELETE FROM merge_batch WHERE project_id = ?'),
    deleteProject: db.prepare<[number]>('DELETE FROM project WHERE id = ?'),
  }
}

export function deleteProjectRows(statements: ProjectStatements, projectId: number): void {
  statements.deleteEvents.run(projectId)
  statements.deleteLinks.run(projectId)
  statements.deleteTemplate.run(projectId)
  statements.deleteRisks.run(projectId)
  statements.deleteDecisions.run(projectId)
  statements.deleteZones.run(projectId)
  statements.deleteWorkflowColumns.run(projectId)
  statements.deleteWorkflows.run(projectId)
  statements.deleteBatchStories.run(projectId)
  statements.deleteBatches.run(projectId)
  statements.deleteProject.run(projectId)
}
