import type Database from 'better-sqlite3'

export type TemplateRow = {
  id: number
  slug: string
  name: string
  version: number
  is_default: number
}

export type ColumnRow = {
  template_id: number
  state: string
  label: string
  colour: string
  agent: string | null
  prompt: string | null
  delay_hours: number | null
}

export function prepareTemplateStatements(db: Database.Database) {
  return {
    selectTemplates: db.prepare<[], TemplateRow>(
      'SELECT id, slug, name, version, is_default FROM column_template ORDER BY slug, version',
    ),
    selectTemplate: db.prepare<[number], TemplateRow>(
      'SELECT id, slug, name, version, is_default FROM column_template WHERE id = ?',
    ),
    selectDefault: db.prepare<[], TemplateRow>(
      `SELECT id, slug, name, version, is_default FROM column_template
      WHERE is_default = 1 ORDER BY version DESC LIMIT 1`,
    ),
    selectLastVersion: db.prepare<[string], { version: number }>(
      'SELECT MAX(version) AS version FROM column_template WHERE slug = ?',
    ),
    selectColumns: db.prepare<[number], ColumnRow>(
      `SELECT template_id, state, label, colour, agent, prompt, delay_hours
       FROM template_column WHERE template_id = ? ORDER BY position`,
    ),
    insertTemplate: db.prepare<[string, string, number, number]>(
      'INSERT INTO column_template (slug, name, version, is_default) VALUES (?, ?, ?, ?)',
    ),
    clearDefault: db.prepare('UPDATE column_template SET is_default = 0'),
    insertColumn: db.prepare<[number, number, string, string, string, string | null, string | null, number | null]>(
      `INSERT INTO template_column
       (template_id, position, state, label, colour, agent, prompt, delay_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    insertAdoption: db.prepare<[number, number]>(
      `INSERT INTO project_template (project_id, template_id) VALUES (?, ?)
      ON CONFLICT (project_id) DO UPDATE SET template_id = excluded.template_id,
                                             adopted_at = datetime('now')`,
    ),
    selectAdoption: db.prepare<[number], { template_id: number }>(
      'SELECT template_id FROM project_template WHERE project_id = ?',
    ),
  }
}
