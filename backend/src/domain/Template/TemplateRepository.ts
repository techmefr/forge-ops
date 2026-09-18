import type Database from 'better-sqlite3'
import type { ColumnTemplate, TemplateColumn, TemplateDraft } from './Template.js'
import { SHIPPED_TEMPLATE, refusalOf } from './Template.js'

export type TemplateRepository = {
  listTemplates: () => readonly ColumnTemplate[]
  findTemplate: (templateId: number) => ColumnTemplate | null
  defaultTemplate: () => ColumnTemplate
  writeVersion: (draft: TemplateDraft) => ColumnTemplate
  adopt: (projectId: number, templateId: number) => void
  templateOfProject: (projectId: number) => ColumnTemplate
}

type TemplateRow = {
  id: number
  slug: string
  name: string
  version: number
  is_default: number
}

type ColumnRow = {
  template_id: number
  state: string
  label: string
  colour: string
  agent: string | null
  prompt: string | null
  delay_hours: number | null
}

export class TemplateRefusedError extends Error {
  constructor(public readonly refusal: NonNullable<ReturnType<typeof refusalOf>>) {
    super(`Le modele de colonnes est refuse: ${refusal.reason} sur ${refusal.stage}`)
    this.name = 'TemplateRefusedError'
  }
}

export function createTemplateRepository(db: Database.Database): TemplateRepository {
  const selectTemplates = db.prepare<[], TemplateRow>(
    'SELECT id, slug, name, version, is_default FROM column_template ORDER BY slug, version',
  )
  const selectTemplate = db.prepare<[number], TemplateRow>(
    'SELECT id, slug, name, version, is_default FROM column_template WHERE id = ?',
  )
  const selectDefault = db.prepare<[], TemplateRow>(
    `SELECT id, slug, name, version, is_default FROM column_template
      WHERE is_default = 1 ORDER BY version DESC LIMIT 1`,
  )
  const selectLastVersion = db.prepare<[string], { version: number }>(
    'SELECT MAX(version) AS version FROM column_template WHERE slug = ?',
  )
  const selectColumns = db.prepare<[number], ColumnRow>(
    `SELECT template_id, state, label, colour, agent, prompt, delay_hours
       FROM template_column WHERE template_id = ? ORDER BY position`,
  )
  const insertTemplate = db.prepare<[string, string, number, number]>(
    'INSERT INTO column_template (slug, name, version, is_default) VALUES (?, ?, ?, ?)',
  )
  const clearDefault = db.prepare('UPDATE column_template SET is_default = 0')
  const insertColumn = db.prepare<
    [number, number, string, string, string, string | null, string | null, number | null]
  >(
    `INSERT INTO template_column
       (template_id, position, state, label, colour, agent, prompt, delay_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertAdoption = db.prepare<[number, number]>(
    `INSERT INTO project_template (project_id, template_id) VALUES (?, ?)
      ON CONFLICT (project_id) DO UPDATE SET template_id = excluded.template_id,
                                             adopted_at = datetime('now')`,
  )
  const selectAdoption = db.prepare<[number], { template_id: number }>(
    'SELECT template_id FROM project_template WHERE project_id = ?',
  )

  function columnsOf(templateId: number): readonly TemplateColumn[] {
    return selectColumns.all(templateId).map((row) => ({
      state: row.state,
      label: row.label,
      colour: row.colour,
      agent: row.agent,
      prompt: row.prompt,
      delayHours: row.delay_hours,
    })) as readonly TemplateColumn[]
  }

  function toTemplate(row: TemplateRow): ColumnTemplate {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      version: row.version,
      isDefault: row.is_default === 1,
      columns: columnsOf(row.id),
    }
  }

  function write(draft: TemplateDraft): ColumnTemplate {
    const refusal = refusalOf(draft.columns)
    if (refusal !== null) {
      throw new TemplateRefusedError(refusal)
    }
    const last = selectLastVersion.get(draft.slug)?.version ?? 0
    const version = last + 1
    if (draft.isDefault) {
      clearDefault.run()
    }
    const written = insertTemplate.run(draft.slug, draft.name, version, draft.isDefault ? 1 : 0)
    const templateId = Number(written.lastInsertRowid)
    draft.columns.forEach((column, position) => {
      insertColumn.run(
        templateId,
        position,
        column.state,
        column.label,
        column.colour,
        column.agent,
        column.prompt,
        column.delayHours,
      )
    })
    return { id: templateId, version, ...draft, columns: [...draft.columns] }
  }

  function fallback(): ColumnTemplate {
    const known = selectDefault.get()
    return known === undefined ? write(SHIPPED_TEMPLATE) : toTemplate(known)
  }

  return {
    listTemplates: () => selectTemplates.all().map(toTemplate),

    findTemplate: (templateId) => {
      const row = selectTemplate.get(templateId)
      return row === undefined ? null : toTemplate(row)
    },

    defaultTemplate: fallback,

    writeVersion: write,

    adopt: (projectId, templateId) => {
      if (selectTemplate.get(templateId) === undefined) {
        throw new TemplateRefusedError({ reason: 'UnknownStage', stage: String(templateId) })
      }
      insertAdoption.run(projectId, templateId)
    },

    templateOfProject: (projectId) => {
      const adopted = selectAdoption.get(projectId)
      if (adopted === undefined) {
        return fallback()
      }
      const row = selectTemplate.get(adopted.template_id)
      return row === undefined ? fallback() : toTemplate(row)
    },
  }
}
