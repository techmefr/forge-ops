import type Database from 'better-sqlite3'
import type { ColumnTemplate, TemplateColumn, TemplateDraft } from './Template.js'
import { SHIPPED_TEMPLATE, refusalOf } from './Template.js'
import { prepareTemplateStatements, type ColumnRow, type TemplateRow } from './TemplateStatements.js'

export type TemplateRepository = {
  listTemplates: () => readonly ColumnTemplate[]
  findTemplate: (templateId: number) => ColumnTemplate | null
  defaultTemplate: () => ColumnTemplate
  writeVersion: (draft: TemplateDraft) => ColumnTemplate
  adopt: (projectId: number, templateId: number) => void
  templateOfProject: (projectId: number) => ColumnTemplate
}

export class TemplateRefusedError extends Error {
  constructor(public readonly refusal: NonNullable<ReturnType<typeof refusalOf>>) {
    super(`Le modele de colonnes est refuse: ${refusal.reason} sur ${refusal.stage}`)
    this.name = 'TemplateRefusedError'
  }
}

function toTemplateWith(row: TemplateRow, columns: readonly ColumnRow[]): ColumnTemplate {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    isDefault: row.is_default === 1,
    columns: columns.map((column) => ({
      state: column.state,
      label: column.label,
      colour: column.colour,
      agent: column.agent,
      prompt: column.prompt,
      delayHours: column.delay_hours,
    })) as readonly TemplateColumn[],
  }
}

export function createTemplateRepository(db: Database.Database): TemplateRepository {
  const {
    selectTemplates,
    selectTemplate,
    selectDefault,
    selectLastVersion,
    selectColumns,
    insertTemplate,
    clearDefault,
    insertColumn,
    insertAdoption,
    selectAdoption,
  } = prepareTemplateStatements(db)

  function toTemplate(row: TemplateRow): ColumnTemplate {
    return toTemplateWith(row, selectColumns.all(row.id))
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
