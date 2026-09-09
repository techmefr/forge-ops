import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(MODULE_DIR, '..', '..', '..', '..', 'db', 'forge.sql')
const BUSY_TIMEOUT_MS = 5000

export function openDatabase(path: string): Database.Database {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`)
  db.pragma('foreign_keys = ON')
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))
  return db
}
