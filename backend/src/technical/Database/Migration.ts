import type Database from 'better-sqlite3'
import { checkedDigestOf, checkedListsOf, createStatementOf } from './SchemaTable.js'

type AddedColumn = {
  table: string
  column: string
  declaration: string
}

export type MigrationStep = {
  name: string
  apply: (db: Database.Database) => void
}

const ADDED_COLUMNS: readonly AddedColumn[] = [
  { table: 'board_user', column: 'email', declaration: 'TEXT' },
  { table: 'epic', column: 'assignee', declaration: 'TEXT' },
  { table: 'project', column: 'checkout_path', declaration: 'TEXT' },
  { table: 'scope_reservation', column: 'renewed_at', declaration: 'TEXT' },
  { table: 'agent_session', column: 'last_heartbeat_at', declaration: 'TEXT' },
  { table: 'agent_session', column: 'context_tokens', declaration: 'INTEGER' },
  { table: 'agent_session', column: 'context_window', declaration: 'INTEGER' },
  { table: 'story', column: 'blocked_reason', declaration: 'TEXT' },
  { table: 'worktree', column: 'forge_card_id', declaration: 'INTEGER' },
]

const CHECKED_TABLES: readonly string[] = [
  'story',
  'checkpoint',
  'agent_session',
  'review_pass',
  'incident',
]

const STEP_LEDGER = `CREATE TABLE IF NOT EXISTS schema_step (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare<[string], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table)
  return row !== undefined
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  return columnsOf(db, table).includes(column)
}

function columnsOf(db: Database.Database, table: string): readonly string[] {
  return db
    .prepare<[string], { name: string }>('SELECT name FROM pragma_table_info(?)')
    .all(table)
    .map((row) => row.name)
}

function storedStatementOf(db: Database.Database, table: string): string | null {
  const row = db
    .prepare<[string], { sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table)
  return row?.sql ?? null
}

const ZONE_KEYED_ON_PROJECT = `CREATE TABLE zone_keyed_on_project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES project(id),
  path_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  colour TEXT NOT NULL,
  summary TEXT,
  summarised_at TEXT,
  UNIQUE (project_id, path_prefix)
)`

function zoneIsKeyedOnPrefixAlone(db: Database.Database): boolean {
  return db
    .prepare<[string], { name: string }>('SELECT name FROM pragma_index_list(?)')
    .all('zone')
    .some((index) => {
      const columns = db
        .prepare<[string], { name: string }>('SELECT name FROM pragma_index_info(?)')
        .all(index.name)
      return columns.length === 1 && columns[0]?.name === 'path_prefix'
    })
}

function rekeyZoneOnProject(db: Database.Database): void {
  if (!tableExists(db, 'zone') || !zoneIsKeyedOnPrefixAlone(db)) {
    return
  }
  db.exec(ZONE_KEYED_ON_PROJECT)
  db.exec(
    `INSERT INTO zone_keyed_on_project (id, project_id, path_prefix, name, colour, summary, summarised_at)
     SELECT id, project_id, path_prefix, name, colour, summary, summarised_at FROM zone`,
  )
  db.exec('DROP TABLE zone')
  db.exec('ALTER TABLE zone_keyed_on_project RENAME TO zone')
}

function rebuildFromSchema(db: Database.Database, table: string, statement: string): void {
  const rebuilt = `${table}_rebuilt`
  db.exec(statement.replace(`CREATE TABLE IF NOT EXISTS ${table} (`, `CREATE TABLE ${rebuilt} (`))
  const carried = columnsOf(db, rebuilt).filter((column) => columnsOf(db, table).includes(column))
  const columns = carried.join(', ')
  db.exec(`INSERT INTO ${rebuilt} (${columns}) SELECT ${columns} FROM ${table}`)
  db.exec(`DROP TABLE ${table}`)
  db.exec(`ALTER TABLE ${rebuilt} RENAME TO ${table}`)
}

function realignChecks(db: Database.Database, table: string, statement: string): void {
  const stored = storedStatementOf(db, table)
  if (stored === null) {
    return
  }
  if (checkedListsOf(stored).join('|') === checkedListsOf(statement).join('|')) {
    return
  }
  rebuildFromSchema(db, table, statement)
}

function checkedTableSteps(schema: string): readonly MigrationStep[] {
  const steps: MigrationStep[] = []
  for (const table of CHECKED_TABLES) {
    const statement = createStatementOf(schema, table)
    if (statement === null) {
      continue
    }
    steps.push({
      name: `checks/${table}/${checkedDigestOf(statement)}`,
      apply: (db) => realignChecks(db, table, statement),
    })
  }
  return steps
}

export function migrationSteps(schema: string): readonly MigrationStep[] {
  return [{ name: 'zone/keyed-on-project', apply: rekeyZoneOnProject }, ...checkedTableSteps(schema)]
}

function stepWasApplied(db: Database.Database, name: string): boolean {
  return (
    db
      .prepare<[string], { name: string }>('SELECT name FROM schema_step WHERE name = ?')
      .get(name) !== undefined
  )
}

export function addMissingColumns(db: Database.Database): void {
  for (const wanted of ADDED_COLUMNS) {
    if (!tableExists(db, wanted.table) || columnExists(db, wanted.table, wanted.column)) {
      continue
    }
    db.exec(`ALTER TABLE ${wanted.table} ADD COLUMN ${wanted.column} ${wanted.declaration}`)
  }
}

export function migrate(
  db: Database.Database,
  schema: string,
  steps: readonly MigrationStep[] = migrationSteps(schema),
): void {
  addMissingColumns(db)
  db.exec(STEP_LEDGER)
  const record = db.prepare<[string], unknown>('INSERT INTO schema_step (name) VALUES (?)')
  db.pragma('foreign_keys = OFF')
  try {
    for (const step of steps) {
      if (stepWasApplied(db, step.name)) {
        continue
      }
      db.transaction(() => {
        step.apply(db)
        record.run(step.name)
      })()
    }
  } finally {
    db.pragma('foreign_keys = ON')
  }
}
