import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../../../src/technical/Database/Connection.js'

const OLD_BOARD_USER = `CREATE TABLE board_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'architect' CHECK (role IN ('director', 'architect')),
  external_subject TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled_at TEXT
)`

let folder: string
let path: string

function columnsOf(db: Database.Database, table: string): readonly string[] {
  return db
    .prepare<[string], { name: string }>('SELECT name FROM pragma_table_info(?)')
    .all(table)
    .map((row) => row.name)
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'forge-migration-'))
  path = join(folder, 'forge.db')
})

afterEach(() => rmSync(folder, { recursive: true, force: true }))

describe('opening a base written before the email column', () => {
  it('adds the column', () => {
    const older = new Database(path)
    older.exec(OLD_BOARD_USER)
    older.close()
    const db = openDatabase(path)
    expect(columnsOf(db, 'board_user')).toContain('email')
    db.close()
  })

  it('keeps the accounts already enrolled', () => {
    const older = new Database(path)
    older.exec(OLD_BOARD_USER)
    older
      .prepare('INSERT INTO board_user (login, display_name, password_hash) VALUES (?, ?, ?)')
      .run('gaetan', 'Gaetan', 'peu importe')
    older.close()
    const db = openDatabase(path)
    expect(
      db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM board_user').get()?.total,
    ).toBe(1)
    db.close()
  })

  it('leaves the address empty on those accounts', () => {
    const older = new Database(path)
    older.exec(OLD_BOARD_USER)
    older
      .prepare('INSERT INTO board_user (login, display_name, password_hash) VALUES (?, ?, ?)')
      .run('gaetan', 'Gaetan', 'peu importe')
    older.close()
    const db = openDatabase(path)
    expect(
      db.prepare<[], { email: string | null }>('SELECT email FROM board_user').get()?.email,
    ).toBeNull()
    db.close()
  })

  it('does not add it twice when opened again', () => {
    const older = new Database(path)
    older.exec(OLD_BOARD_USER)
    older.close()
    openDatabase(path).close()
    const db = openDatabase(path)
    expect(columnsOf(db, 'board_user').filter((name) => name === 'email')).toHaveLength(1)
    db.close()
  })

  it('gives a fresh base the column straight away', () => {
    const db = openDatabase(path)
    expect(columnsOf(db, 'board_user')).toContain('email')
    db.close()
  })
})
