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

const OLD_AGENT_SESSION = `CREATE TABLE agent_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL,
  claude_session_id TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL DEFAULT 'code',
  agent_name TEXT NOT NULL DEFAULT 'neo',
  lifecycle TEXT NOT NULL DEFAULT 'starting',
  claude_code_version TEXT NOT NULL,
  cost_usd REAL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT
)`

const OLD_ZONE = `CREATE TABLE zone (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  path_prefix TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  colour TEXT NOT NULL,
  summary TEXT,
  summarised_at TEXT
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

describe('opening a base whose zones were keyed on the prefix alone', () => {
  function writeOldZone(): void {
    const older = new Database(path)
    older.exec(OLD_ZONE)
    older
      .prepare('INSERT INTO zone (project_id, path_prefix, name, colour) VALUES (?, ?, ?, ?)')
      .run(1, 'services/cart', 'Panier', '#8B5CFF')
    older.close()
  }

  it('keeps the zones already declared', () => {
    writeOldZone()
    const db = openDatabase(path)
    expect(
      db
        .prepare<[], { path_prefix: string; name: string }>('SELECT path_prefix, name FROM zone')
        .all(),
    ).toEqual([{ path_prefix: 'services/cart', name: 'Panier' }])
    db.close()
  })

  function enrolProjects(db: Database.Database): void {
    const insert = db.prepare(
      'INSERT INTO project (slug, name, repository_url, integration_branch, colour) VALUES (?, ?, ?, ?, ?)',
    )
    insert.run('ps', 'Panier', 'git@example.com:ps.git', 'main', '#8B5CFF')
    insert.run('vs', 'Voisin', 'git@example.com:vs.git', 'main', '#00E0FF')
  }

  it('lets two projects hold the same prefix', () => {
    writeOldZone()
    const db = openDatabase(path)
    enrolProjects(db)
    expect(() =>
      db
        .prepare('INSERT INTO zone (project_id, path_prefix, name, colour) VALUES (?, ?, ?, ?)')
        .run(2, 'services/cart', 'Panier voisin', '#00E0FF'),
    ).not.toThrow()
    db.close()
  })

  it('refuses the same prefix twice inside one project', () => {
    writeOldZone()
    const db = openDatabase(path)
    enrolProjects(db)
    expect(() =>
      db
        .prepare('INSERT INTO zone (project_id, path_prefix, name, colour) VALUES (?, ?, ?, ?)')
        .run(1, 'services/cart', 'Panier bis', '#8B5CFF'),
    ).toThrow()
    db.close()
  })

  it('does not rebuild the table again when opened twice', () => {
    writeOldZone()
    openDatabase(path).close()
    const db = openDatabase(path)
    expect(db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM zone').get()?.total).toBe(1)
    db.close()
  })
})

describe('opening a base written before the heartbeat column', () => {
  it('adds the column', () => {
    const older = new Database(path)
    older.exec(OLD_AGENT_SESSION)
    older.close()
    const db = openDatabase(path)
    expect(columnsOf(db, 'agent_session')).toContain('last_heartbeat_at')
    db.close()
  })

  it('keeps the sessions already recorded', () => {
    const older = new Database(path)
    older.exec(OLD_AGENT_SESSION)
    older
      .prepare('INSERT INTO agent_session (story_id, claude_session_id, claude_code_version) VALUES (?, ?, ?)')
      .run(1, 'sess-old', '2.1.218')
    older.close()
    const db = openDatabase(path)
    expect(
      db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM agent_session').get()?.total,
    ).toBe(1)
    db.close()
  })

  it('does not add it twice when opened again', () => {
    const older = new Database(path)
    older.exec(OLD_AGENT_SESSION)
    older.close()
    openDatabase(path).close()
    const db = openDatabase(path)
    expect(columnsOf(db, 'agent_session').filter((name) => name === 'last_heartbeat_at')).toHaveLength(1)
    db.close()
  })
})

const OLD_STORY = `CREATE TABLE story (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epic_id INTEGER NOT NULL,
  twin_of_story_id INTEGER,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('functional', 'test')),
  state TEXT NOT NULL DEFAULT 'drafting' CHECK (state IN (
    'drafting',
    'backlog',
    'building',
    'done'
  )),
  points INTEGER,
  rollout_percent INTEGER,
  merge_conflict INTEGER NOT NULL DEFAULT 0,
  escalation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`
describe('opening a base whose story states predate the current domain', () => {
  function writeOldStory(): void {
    const older = new Database(path)
    older.exec(OLD_STORY)
    older
      .prepare('INSERT INTO story (epic_id, reference, title, body, kind, state) VALUES (?, ?, ?, ?, ?, ?)')
      .run(1, 'FORGE-1', 'Titre', 'Corps', 'functional', 'backlog')
    older.close()
  }

  function enrolEpic(db: Database.Database): void {
    db.prepare(
      'INSERT INTO project (slug, name, repository_url, integration_branch, colour) VALUES (?, ?, ?, ?, ?)',
    ).run('ps', 'Panier', 'git@example.com:ps.git', 'main', '#8B5CFF')
    db.prepare('INSERT INTO epic (project_id, title, business_intent) VALUES (?, ?, ?)').run(
      1,
      'Epique',
      'Intention',
    )
  }

  it('accepts a state the older constraint refused', () => {
    writeOldStory()
    const db = openDatabase(path)
    enrolEpic(db)
    expect(() =>
      db
        .prepare(
          'INSERT INTO story (epic_id, reference, title, body, kind, state) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(1, 'FORGE-2', 'Titre', 'Corps', 'functional', 'escalated'),
    ).not.toThrow()
    db.close()
  })

  it('still refuses a state the domain does not declare', () => {
    writeOldStory()
    const db = openDatabase(path)
    enrolEpic(db)
    expect(() =>
      db
        .prepare(
          'INSERT INTO story (epic_id, reference, title, body, kind, state) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(1, 'FORGE-3', 'Titre', 'Corps', 'functional', 'inert_state'),
    ).toThrow()
    db.close()
  })

  it('keeps the stories already written', () => {
    writeOldStory()
    const db = openDatabase(path)
    expect(
      db.prepare<[], { reference: string }>('SELECT reference FROM story').all(),
    ).toEqual([{ reference: 'FORGE-1' }])
    db.close()
  })

  it('records the step so a second opening does not rebuild again', () => {
    writeOldStory()
    openDatabase(path).close()
    const db = openDatabase(path)
    expect(
      db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM schema_step').get()?.total,
    ).toBeGreaterThan(0)
    expect(db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM story').get()?.total).toBe(1)
    db.close()
  })

  it('leaves a fresh base alone', () => {
    const db = openDatabase(path)
    expect(db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM story').get()?.total).toBe(0)
    db.close()
  })
})
