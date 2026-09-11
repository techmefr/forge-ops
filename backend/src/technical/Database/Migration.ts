import type Database from 'better-sqlite3'

type AddedColumn = {
  table: string
  column: string
  declaration: string
}

const ADDED_COLUMNS: readonly AddedColumn[] = [
  { table: 'board_user', column: 'email', declaration: 'TEXT' },
  { table: 'epic', column: 'assignee', declaration: 'TEXT' },
  { table: 'project', column: 'checkout_path', declaration: 'TEXT' },
  { table: 'agent_session', column: 'carried_cost_usd', declaration: 'REAL NOT NULL DEFAULT 0' },
  { table: 'agent_session', column: 'carried_input_tokens', declaration: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'agent_session', column: 'carried_output_tokens', declaration: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'scope_reservation', column: 'renewed_at', declaration: 'TEXT' },
  { table: 'agent_session', column: 'last_heartbeat_at', declaration: 'TEXT' },
]

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare<[string], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table)
  return row !== undefined
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  return db
    .prepare<[string], { name: string }>('SELECT name FROM pragma_table_info(?)')
    .all(table)
    .some((row) => row.name === column)
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
  db.pragma('foreign_keys = OFF')
  db.exec(ZONE_KEYED_ON_PROJECT)
  db.exec(
    `INSERT INTO zone_keyed_on_project (id, project_id, path_prefix, name, colour, summary, summarised_at)
     SELECT id, project_id, path_prefix, name, colour, summary, summarised_at FROM zone`,
  )
  db.exec('DROP TABLE zone')
  db.exec('ALTER TABLE zone_keyed_on_project RENAME TO zone')
  db.pragma('foreign_keys = ON')
}

export function addMissingColumns(db: Database.Database): void {
  for (const wanted of ADDED_COLUMNS) {
    if (!tableExists(db, wanted.table) || columnExists(db, wanted.table, wanted.column)) {
      continue
    }
    db.exec(`ALTER TABLE ${wanted.table} ADD COLUMN ${wanted.column} ${wanted.declaration}`)
  }
  rekeyZoneOnProject(db)
}
