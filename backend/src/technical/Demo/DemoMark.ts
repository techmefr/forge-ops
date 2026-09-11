import Database from 'better-sqlite3'

export const DEMO_MARK_KEY = 'demo_database'

const SETTING_TABLE = `CREATE TABLE IF NOT EXISTS board_setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`

export function markDemoDatabase(db: Database.Database): void {
  db.exec(SETTING_TABLE)
  db.prepare<[string, string]>(
    'INSERT INTO board_setting (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
  ).run(DEMO_MARK_KEY, new Date().toISOString())
}

export function carriesDemoMark(dbPath: string): boolean {
  let db: Database.Database | null = null
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true })
    const row = db
      .prepare<[string], { value: string }>('SELECT value FROM board_setting WHERE key = ?')
      .get(DEMO_MARK_KEY)
    return row !== undefined
  } catch {
    return false
  } finally {
    db?.close()
  }
}
