import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DB_PATH = process.env.STARFLEET_DB_PATH ?? join(MODULE_DIR, '..', '..', 'starfleet.db')
const SCHEMA_PATH = join(MODULE_DIR, '..', '..', 'db', 'schema.sql')
const BUSY_TIMEOUT_MS = 5000

let dbInstance: Database.Database | null = null

function applySchema(db: Database.Database): void {
  if (!existsSync(SCHEMA_PATH)) {
    throw new Error(`Schema file not found at ${SCHEMA_PATH}`)
  }
  const schema = readFileSync(SCHEMA_PATH, 'utf-8')
  db.exec(schema)
}

export function getDb(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  if (dbInstance !== null) {
    return dbInstance
  }
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`)
  db.pragma('foreign_keys = ON')
  applySchema(db)
  dbInstance = db
  return dbInstance
}

export function closeDb(): void {
  if (dbInstance === null) {
    return
  }
  dbInstance.close()
  dbInstance = null
}
