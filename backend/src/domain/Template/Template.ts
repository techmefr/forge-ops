import type {
  ColumnTemplate,
  TemplateColumn,
  TemplateDraft,
} from '../../../../contract/BoardContract.js'
import { KANBAN_COLUMNS } from '../Story/Story.js'

export type { ColumnTemplate, TemplateColumn, TemplateDraft }

export const TEMPLATE_STAGES = KANBAN_COLUMNS.map((column) => column.key)

export type TemplateRefusal =
  | { reason: 'UnknownStage'; stage: string }
  | { reason: 'RepeatedStage'; stage: string }
  | { reason: 'MissingStage'; stage: string }
  | { reason: 'EmptyLabel'; stage: string }
  | { reason: 'NegativeDelay'; stage: string }

export function refusalOf(columns: readonly TemplateColumn[]): TemplateRefusal | null {
  const seen = new Set<string>()
  for (const column of columns) {
    if (!(TEMPLATE_STAGES as readonly string[]).includes(column.state)) {
      return { reason: 'UnknownStage', stage: column.state }
    }
    if (seen.has(column.state)) {
      return { reason: 'RepeatedStage', stage: column.state }
    }
    seen.add(column.state)
    if (column.label.trim() === '') {
      return { reason: 'EmptyLabel', stage: column.state }
    }
    if (column.delayHours !== null && column.delayHours < 0) {
      return { reason: 'NegativeDelay', stage: column.state }
    }
  }
  const missing = TEMPLATE_STAGES.find((stage) => !seen.has(stage))
  return missing === undefined ? null : { reason: 'MissingStage', stage: missing }
}

export const WRITING_AGENT = 'architect'

export const WRITING_PROMPT = [
  'Ecris la story {reference} avec l architecte : {title}.',
  '',
  '{body}',
  '',
  'Pose les questions qui manquent, propose le decoupage, puis redige la specification.',
  'Tu ne valides jamais toi meme : c est l humain qui envoie la carte a la reserve.',
].join('\n')

export const SHIPPED_TEMPLATE: TemplateDraft = {
  slug: 'shipped',
  name: 'Forge',
  isDefault: true,
  columns: KANBAN_COLUMNS.map((column, position) => ({
    state: column.key,
    label: column.label,
    colour: column.colour,
    agent: position === 0 ? WRITING_AGENT : null,
    prompt: position === 0 ? WRITING_PROMPT : null,
    delayHours: null,
  })),
}

export function toJsonl(template: ColumnTemplate): string {
  const header = {
    record: 'template',
    slug: template.slug,
    name: template.name,
    version: template.version,
    isDefault: template.isDefault,
  }
  const lines = [header, ...template.columns.map((column) => ({ record: 'column', ...column }))]
  return lines.map((line) => JSON.stringify(line)).join('\n')
}

export type TemplateReading =
  | { draft: TemplateDraft; refusal?: undefined }
  | { refusal: TemplateRefusal | 'MalformedLine' | 'NoHeader'; draft?: undefined }

function columnOf(record: Record<string, unknown>): TemplateColumn {
  return {
    state: String(record.state ?? ''),
    label: String(record.label ?? ''),
    colour: String(record.colour ?? 'line'),
    agent: record.agent === null || record.agent === undefined ? null : String(record.agent),
    prompt: record.prompt === null || record.prompt === undefined ? null : String(record.prompt),
    delayHours:
      record.delayHours === null || record.delayHours === undefined
        ? null
        : Number(record.delayHours),
  } as TemplateColumn
}

export function fromJsonl(text: string): TemplateReading {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const records: Record<string, unknown>[] = []
  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line)
      if (typeof parsed !== 'object' || parsed === null) {
        return { refusal: 'MalformedLine' }
      }
      records.push(parsed as Record<string, unknown>)
    } catch {
      return { refusal: 'MalformedLine' }
    }
  }
  const header = records[0]
  if (header === undefined || header.record !== 'template') {
    return { refusal: 'NoHeader' }
  }
  const columns = records.slice(1).map(columnOf)
  const refusal = refusalOf(columns)
  if (refusal !== null) {
    return { refusal }
  }
  return {
    draft: {
      slug: String(header.slug ?? ''),
      name: String(header.name ?? ''),
      isDefault: header.isDefault === true,
      columns,
    },
  }
}
