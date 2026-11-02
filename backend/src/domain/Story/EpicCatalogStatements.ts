import type Database from 'better-sqlite3'

export type EpicCatalogStatements = ReturnType<typeof prepareEpicCatalogStatements>

export function prepareEpicCatalogStatements(db: Database.Database) {
  return {
    insertEpic: db.prepare<[number, string, string]>(
      'INSERT INTO epic (project_id, title, business_intent) VALUES (?, ?, ?)',
    ),
    selectEpics: db.prepare<
      [number, number],
      {
        id: number
        project_id: number
        title: string
        business_intent: string
        assignee: string | null
        story_count: number
      }
    >(
      `SELECT epic.id, epic.project_id, epic.title, epic.business_intent, epic.assignee,
              COUNT(story.id) AS story_count
         FROM epic
         LEFT JOIN story ON story.epic_id = epic.id AND story.kind = 'functional'
        WHERE epic.project_id = ? AND (epic.deleted_at IS NOT NULL) = ?
        GROUP BY epic.id
        ORDER BY epic.id`,
    ),
    selectEpicById: db.prepare<[number], { id: number; project_id: number; assignee: string | null }>(
      'SELECT id, project_id, assignee FROM epic WHERE id = ?',
    ),
    updateEpicAssignee: db.prepare<[string | null, number]>('UPDATE epic SET assignee = ? WHERE id = ?'),
    selectDisabledAt: db.prepare<[string], { disabled_at: string | null }>(
      'SELECT disabled_at FROM board_user WHERE login = ?',
    ),
    selectProjectById: db.prepare<[number], { id: number }>('SELECT id FROM project WHERE id = ?'),
    selectFullEpic: db.prepare<[number], { id: number; project_id: number; title: string; business_intent: string }>(
      'SELECT id, project_id, title, business_intent FROM epic WHERE id = ?',
    ),
  }
}
