import type Database from 'better-sqlite3'

type AddedColumn = {
  table: string
  column: string
  declaration: string
}

const ADDED_COLUMNS: readonly AddedColumn[] = [
  { table: 'board_user', column: 'email', declaration: 'TEXT' },
  { table: 'epic', column: 'assignee', declaration: 'TEXT' },
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

export function addMissingColumns(db: Database.Database): void {
  for (const wanted of ADDED_COLUMNS) {
    if (!tableExists(db, wanted.table) || columnExists(db, wanted.table, wanted.column)) {
      continue
    }
    db.exec(`ALTER TABLE ${wanted.table} ADD COLUMN ${wanted.column} ${wanted.declaration}`)
  }
}
