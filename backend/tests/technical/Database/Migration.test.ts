import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../../../src/technical/Database/Connection.js'
import { migrate } from '../../../src/technical/Database/Migration.js'

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

describe('opening a base written before the super admin flag', () => {
  it('adds the flag and leaves existing accounts unflagged', () => {
    const older = new Database(path)
    older.exec(OLD_BOARD_USER)
    older
      .prepare('INSERT INTO board_user (login, display_name, password_hash) VALUES (?, ?, ?)')
      .run('gaetan', 'Gaetan', 'peu importe')
    older.close()
    const db = openDatabase(path)
    expect(columnsOf(db, 'board_user')).toContain('super_admin')
    expect(
      db.prepare<[], { super_admin: number }>('SELECT super_admin FROM board_user').get()?.super_admin,
    ).toBe(0)
    db.close()
  })
})

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

describe('migrate atomicity', () => {
  it('rolls a failing step back and puts foreign keys back on', () => {
    const db = new Database(':memory:')
    const exploding = [
      {
        name: 'step/that-throws',
        apply: (target: Database.Database) => {
          target.exec('CREATE TABLE half_built (id INTEGER PRIMARY KEY)')
          throw new Error('the step blew up')
        },
      },
    ]

    expect(() => migrate(db, '', exploding)).toThrow('the step blew up')
    expect(
      db
        .prepare<[], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'half_built'",
        )
        .get(),
    ).toBeUndefined()
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    db.close()
  })
})

describe('opening a base written before the epic planning fields', () => {
  const OLD_EPIC = `CREATE TABLE epic (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  business_intent TEXT NOT NULL,
  assignee TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`

  function writeOldEpic(): void {
    const older = new Database(path)
    older.exec(OLD_EPIC)
    older
      .prepare('INSERT INTO epic (project_id, title, business_intent, assignee) VALUES (?, ?, ?, ?)')
      .run(1, 'Cloudmail', 'Mail', 'gaetan')
    older.close()
  }

  it('adds the planning columns', () => {
    writeOldEpic()
    const db = openDatabase(path)
    expect(columnsOf(db, 'epic')).toEqual(
      expect.arrayContaining(['priority', 'started_on', 'status_note', 'requested_by', 'deleted_at']),
    )
    db.close()
  })

  it('leaves the epics already written as they were, at normal priority', () => {
    writeOldEpic()
    const db = openDatabase(path)
    expect(
      db
        .prepare<[], Record<string, unknown>>('SELECT title, assignee, priority, started_on, deleted_at FROM epic')
        .all(),
    ).toEqual([
      { title: 'Cloudmail', assignee: 'gaetan', priority: 'normal', started_on: null, deleted_at: null },
    ])
    db.close()
  })

  it('creates the tag, link, dependency and history tables', () => {
    writeOldEpic()
    const db = openDatabase(path)
    for (const table of ['tag', 'epic_tag', 'epic_link', 'project_link', 'epic_dependency', 'epic_state_history']) {
      expect(columnsOf(db, table).length).toBeGreaterThan(0)
    }
    db.close()
  })

  it('adds nothing twice when opened again', () => {
    writeOldEpic()
    openDatabase(path).close()
    const db = openDatabase(path)
    expect(columnsOf(db, 'epic').filter((name) => name === 'priority')).toHaveLength(1)
    db.close()
  })
})

describe('opening a base written before the roadmap events', () => {
  const OLD_EPIC_MILESTONE = `CREATE TABLE epic_milestone (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epic_id INTEGER NOT NULL REFERENCES epic(id),
  kind TEXT NOT NULL CHECK (kind IN ('demo', 'production', 'everyone')),
  due_on TEXT NOT NULL,
  UNIQUE (epic_id, kind)
)`

  function writeOldMilestones(): void {
    const older = new Database(path)
    older.exec(
      'CREATE TABLE project (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, name TEXT NOT NULL, repository_url TEXT NOT NULL, integration_branch TEXT NOT NULL, colour TEXT NOT NULL)',
    )
    older.exec('CREATE TABLE epic (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, title TEXT NOT NULL, business_intent TEXT NOT NULL)')
    older.exec(OLD_EPIC_MILESTONE)
    older.prepare('INSERT INTO project (slug, name, repository_url, integration_branch, colour) VALUES (?, ?, ?, ?, ?)').run('a', 'A', 'u', 'main', '#000000')
    older.prepare('INSERT INTO epic (project_id, title, business_intent) VALUES (?, ?, ?)').run(1, 'Cloudmail', 'Mail')
    older.prepare('INSERT INTO epic_milestone (epic_id, kind, due_on) VALUES (?, ?, ?)').run(1, 'demo', '2026-10-01')
    older.close()
  }

  it('adds the event columns and keeps the milestones already written', () => {
    writeOldMilestones()
    const db = openDatabase(path)
    expect(columnsOf(db, 'epic_milestone')).toEqual(
      expect.arrayContaining(['project_id', 'title', 'note', 'minutes', 'minutes_updated_at']),
    )
    expect(
      db.prepare<[], { epic_id: number; kind: string; due_on: string }>('SELECT epic_id, kind, due_on FROM epic_milestone').all(),
    ).toEqual([{ epic_id: 1, kind: 'demo', due_on: '2026-10-01' }])
    db.close()
  })

  it('places the milestones already written on the project of their epic', () => {
    writeOldMilestones()
    const db = openDatabase(path)
    expect(db.prepare<[], { project_id: number }>('SELECT project_id FROM epic_milestone').get()?.project_id).toBe(1)
    db.close()
  })

  it('accepts the new types, several of one type on an epic, and an event with no epic', () => {
    writeOldMilestones()
    const db = openDatabase(path)
    const add = db.prepare('INSERT INTO epic_milestone (epic_id, project_id, kind, due_on) VALUES (?, ?, ?, ?)')
    expect(() => {
      add.run(1, 1, 'client', '2026-10-02')
      add.run(1, 1, 'client', '2026-10-03')
      add.run(null, 1, 'steering', '2026-10-04')
    }).not.toThrow()
    expect(() => add.run(null, 1, 'party', '2026-10-05')).toThrow()
    db.close()
  })
})

const OLD_PROJECT = `CREATE TABLE project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  integration_branch TEXT NOT NULL,
  colour TEXT NOT NULL,
  checkout_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`

const INSERT_PROJECT =
  "INSERT INTO project (slug, name, repository_url, integration_branch, colour) VALUES (?, ?, 'u', 'main', '#ffffff')"

describe('opening a base written before the project admin, position and user capacity', () => {
  it('adds the columns, keeps the rows and orders the projects by name', () => {
    const older = new Database(path)
    older.exec(OLD_BOARD_USER)
    older.exec(OLD_PROJECT)
    const insert = older.prepare(INSERT_PROJECT)
    insert.run('zeta', 'Zeta')
    insert.run('alpha', 'Alpha')
    older.close()

    const db = openDatabase(path)

    expect(columnsOf(db, 'project')).toEqual(expect.arrayContaining(['admin_user_id', 'position']))
    expect(columnsOf(db, 'board_user')).toContain('capacity')
    expect(
      db
        .prepare<[], { name: string; position: number; admin_user_id: number | null }>(
          'SELECT name, position, admin_user_id FROM project ORDER BY position',
        )
        .all(),
    ).toEqual([
      { name: 'Alpha', position: 0, admin_user_id: null },
      { name: 'Zeta', position: 1, admin_user_id: null },
    ])
    db.close()
  })

  it('does not renumber the projects on the next opening', () => {
    const older = new Database(path)
    older.exec(OLD_BOARD_USER)
    older.exec(OLD_PROJECT)
    older.prepare(INSERT_PROJECT).run('a', 'Alpha')
    older.close()
    const first = openDatabase(path)
    first.prepare('UPDATE project SET position = 7').run()
    first.close()

    const second = openDatabase(path)

    expect(second.prepare<[], { position: number }>('SELECT position FROM project').get()?.position).toBe(7)
    second.close()
  })
})

describe('opening a base written before the project follow-up', () => {
  it('adds the status sentence and the weather override, both empty for the projects already written', () => {
    const older = new Database(path)
    older.exec(OLD_PROJECT)
    older.prepare(INSERT_PROJECT).run('skera', 'Skera')
    older.close()
    const db = openDatabase(path)
    expect(columnsOf(db, 'project')).toEqual(expect.arrayContaining(['status_sentence', 'weather_override']))
    expect(
      db.prepare<[], Record<string, unknown>>('SELECT name, status_sentence, weather_override FROM project').all(),
    ).toEqual([{ name: 'Skera', status_sentence: null, weather_override: null }])
    db.close()
  })

  it('creates the risk and decision tables', () => {
    const older = new Database(path)
    older.exec(OLD_PROJECT)
    older.close()
    const db = openDatabase(path)
    for (const table of ['project_risk', 'project_decision']) {
      expect(columnsOf(db, table).length).toBeGreaterThan(0)
    }
    db.close()
  })
})

const OLD_PROJECT_WITHOUT_ADMIN = `CREATE TABLE project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  integration_branch TEXT NOT NULL,
  colour TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`

const OLD_WORKFLOW_COLUMN = `CREATE TABLE workflow_column (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  colour TEXT NOT NULL,
  position INTEGER NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  command TEXT NOT NULL,
  preprompt TEXT NOT NULL DEFAULT "",
  behavioural_kind TEXT NOT NULL DEFAULT "ordinary",
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`

describe("opening a base whose workflow columns were global", () => {
  function writeGlobalWorkflow(projects: number): void {
    const older = new Database(path)
    older.exec(OLD_PROJECT_WITHOUT_ADMIN)
    older.exec(OLD_WORKFLOW_COLUMN)
    for (let index = 1; index <= projects; index += 1) {
      older
        .prepare("INSERT INTO project (slug, name, repository_url, integration_branch, colour) VALUES (?, ?, ?, ?, ?)")
        .run(`p${index}`, `P${index}`, "url", "main", "#112233")
    }
    const insert = older.prepare(
      "INSERT INTO workflow_column (key, label, colour, position, agent_name, command, preprompt, behavioural_kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    insert.run("backlog", "Reserve", "line", 1, "architecte", "SPEC.md", "", "ordinary")
    insert.run("architecture", "Plan", "info", 2, "architecte", "PLAN.md", "hello", "ordinary")
    insert.run("plan_review", "Plan a valider", "warn", 3, "", "", "", "human_wait")
    insert.run("building", "Dev", "acc", 4, "trinity", "BUILD.md", "", "ordinary")
    insert.run("done", "Prod", "green", 5, "", "", "", "human_wait")
    older.close()
  }

  type Row = {
    project_id: number
    key: string
    position: number
    provider: string
    model: string
    effort: string
    agent_name: string
    preprompt: string
    auto_start: number
  }

  function rows(db: Database.Database): readonly Row[] {
    return db
      .prepare<[], Row>("SELECT * FROM workflow_column ORDER BY project_id, position")
      .all()
  }

  it("copies the steps between backlog and done into every project", () => {
    writeGlobalWorkflow(2)
    const db = openDatabase(path)
    const copied = rows(db)
    expect(copied.map((row) => `${row.project_id}:${row.key}:${row.position}`)).toEqual([
      "1:architecture:1",
      "1:plan_review:2",
      "1:building:3",
      "2:architecture:1",
      "2:plan_review:2",
      "2:building:3",
    ])
    db.close()
  })

  it("gives the copied steps a provider, a model and an effort", () => {
    writeGlobalWorkflow(1)
    const db = openDatabase(path)
    const [plan, review] = rows(db)
    expect(plan).toMatchObject({ provider: "claude", model: "claude-sonnet-5", effort: "high", agent_name: "architecte", preprompt: "hello", auto_start: 0 })
    expect(review).toMatchObject({ provider: "human", model: "", effort: "", auto_start: 0 })
    db.close()
  })

  it("drops the global steps when there is no project to copy them to", () => {
    writeGlobalWorkflow(0)
    const db = openDatabase(path)
    expect(rows(db)).toEqual([])
    db.close()
  })

  it("does not copy twice when opened again", () => {
    writeGlobalWorkflow(1)
    openDatabase(path).close()
    const db = openDatabase(path)
    expect(rows(db)).toHaveLength(3)
    db.close()
  })
})

describe("opening a base whose stories were placed by their state alone", () => {
  function seedPlacedByState(): void {
    const db = openDatabase(path)
    db.prepare(
      "INSERT INTO project (slug, name, repository_url, integration_branch, colour) VALUES ('p', 'P', 'url', 'main', '#112233')",
    ).run()
    db.prepare(
      "INSERT INTO workflow_column (project_id, key, label, colour, position, behavioural_kind) VALUES (1, 'building', 'Building', 'acc', 1, 'ordinary')",
    ).run()
    db.prepare("INSERT INTO epic (project_id, title, business_intent) VALUES (1, 'E', 'i')").run()
    const insert = db.prepare(
      "INSERT INTO story (epic_id, reference, title, body, kind, state) VALUES (1, ?, 't', 'b', 'functional', ?)",
    )
    insert.run("S-1", "building")
    insert.run("S-2", "backlog")
    insert.run("S-3", "gating")
    db.prepare("DELETE FROM schema_step WHERE name = 'story/workflow-column'").run()
    db.close()
  }

  it("points each story at the step its state names, and leaves the others alone", () => {
    seedPlacedByState()
    const db = openDatabase(path)
    const placed = db
      .prepare<[], { reference: string; workflow_column_id: number | null }>("SELECT reference, workflow_column_id FROM story ORDER BY reference")
      .all()
    expect(placed).toEqual([
      { reference: "S-1", workflow_column_id: 1 },
      { reference: "S-2", workflow_column_id: null },
      { reference: "S-3", workflow_column_id: null },
    ])
    db.close()
  })
})

describe('opening a base that unique-indexed every email', () => {
  it('lets two accounts hold the same unverified address and still refuses two verified ones', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'forge-email-')), 'forge.db')
    const legacy = new Database(file)
    legacy.exec(
      "CREATE TABLE board_user (id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT NOT NULL UNIQUE, email TEXT, email_verified_at TEXT); CREATE UNIQUE INDEX idx_board_user_email ON board_user(email) WHERE email IS NOT NULL",
    )
    legacy.close()

    const db = openDatabase(file)
    const insert = db.prepare<[string, string, string | null]>(
      'INSERT INTO board_user (login, email, email_verified_at) VALUES (?, ?, ?)',
    )
    insert.run('a', 'x@example.com', null)
    insert.run('b', 'x@example.com', null)
    insert.run('c', 'y@example.com', '2026-10-01')

    expect(() => insert.run('d', 'y@example.com', '2026-10-01')).toThrow(/UNIQUE/)
    db.close()
  })
})
