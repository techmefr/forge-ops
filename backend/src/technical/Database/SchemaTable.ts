import { createHash } from 'node:crypto'

const CHECKED_LIST = /\bIN\s*\(([^)]*)\)/g

export function createStatementOf(schema: string, table: string): string | null {
  const opening = schema.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`)
  if (opening < 0) {
    return null
  }
  const closing = schema.indexOf('\n);', opening)
  if (closing < 0) {
    return null
  }
  return schema.slice(opening, closing + 2)
}

export function checkedListsOf(statement: string): readonly string[] {
  return [...statement.matchAll(CHECKED_LIST)].map((match) =>
    (match[1] ?? '').replace(/\s+/g, ' ').trim(),
  )
}

export function checkedDigestOf(statement: string): string {
  return createHash('sha1').update(checkedListsOf(statement).join('|')).digest('hex').slice(0, 12)
}
